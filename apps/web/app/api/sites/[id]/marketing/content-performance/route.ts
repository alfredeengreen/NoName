import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@analytics/db';
import { verifySiteAccess } from '@/lib/auth-helpers';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { authorized, site } = await verifySiteAccess(params.id);
    if (!authorized || !site) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const start = searchParams.get('start') ? new Date(searchParams.get('start')!) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = searchParams.get('end') ? new Date(searchParams.get('end')!) : new Date();

    const pool = getPool();

    // Get content performance (which pages convert best)
    const result = await pool.query(
      `
      SELECT 
        e.path,
        COUNT(DISTINCT e.vid)::INTEGER as visitors,
        COUNT(DISTINCT e.sid)::INTEGER as sessions,
        COUNT(CASE WHEN e.event_type = 'inc' THEN 1 END)::INTEGER as pageviews,
        COUNT(CASE WHEN conv.sid IS NOT NULL THEN 1 END)::INTEGER as conversions,
        ROUND(
          COUNT(CASE WHEN conv.sid IS NOT NULL THEN 1 END)::NUMERIC / 
          NULLIF(COUNT(DISTINCT e.vid), 0)::NUMERIC * 100, 
          2
        ) as conversion_rate,
        COALESCE(SUM(conv.revenue), 0)::NUMERIC as revenue,
        CASE 
          WHEN COUNT(DISTINCT e.vid) > 0 THEN
            ROUND(COALESCE(SUM(conv.revenue), 0) / COUNT(DISTINCT e.vid)::NUMERIC, 2)
          ELSE 0
        END as revenue_per_visitor,
        AVG(CASE WHEN e.event_type = 'inc' THEN 1 ELSE 0 END)::NUMERIC as avg_pageviews_per_session
      FROM events_raw e
      LEFT JOIN (
        SELECT 
          sid,
          SUM(COALESCE(value, 0)) as revenue
        FROM events_raw
        WHERE site_id = $1
          AND event_name = 'purchase'
          AND ts >= $2
          AND ts <= $3
        GROUP BY sid
      ) conv ON e.sid = conv.sid
      WHERE e.site_id = $1
        AND e.ts >= $2
        AND e.ts <= $3
      GROUP BY e.path
      HAVING COUNT(DISTINCT e.vid) > 10
      ORDER BY conversion_rate DESC, revenue DESC
      LIMIT 50
      `,
      [site.id, start, end]
    );

    return NextResponse.json({ content: result.rows });
  } catch (error) {
    console.error('Error fetching content performance:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


