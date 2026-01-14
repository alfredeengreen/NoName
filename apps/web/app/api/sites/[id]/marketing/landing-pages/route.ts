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

    // Get landing page performance with conversion metrics
    const result = await pool.query(
      `
      WITH landing_pages AS (
        SELECT DISTINCT ON (e.sid) 
          e.path as landing_path,
          e.sid,
          e.vid,
          e.ts as landing_time
        FROM events_raw e
        WHERE e.site_id = $1
          AND e.ts >= $2
          AND e.ts <= $3
          AND e.event_type = 'inc'
        ORDER BY e.sid, e.ts ASC
      ),
      conversions AS (
        SELECT 
          e.sid,
          COUNT(CASE WHEN e.event_name = 'purchase' THEN 1 END) as conversion_count,
          SUM(CASE WHEN e.event_name = 'purchase' THEN COALESCE(e.value, 0) ELSE 0 END) as revenue
        FROM events_raw e
        WHERE e.site_id = $1
          AND e.ts >= $2
          AND e.ts <= $3
          AND e.event_name = 'purchase'
        GROUP BY e.sid
      ),
      bounces AS (
        SELECT 
          e.sid,
          COUNT(*) as page_count
        FROM events_raw e
        WHERE e.site_id = $1
          AND e.ts >= $2
          AND e.ts <= $3
          AND e.event_type = 'inc'
        GROUP BY e.sid
        HAVING COUNT(*) = 1
      )
      SELECT 
        lp.landing_path as path,
        COUNT(DISTINCT lp.sid)::INTEGER as sessions,
        COUNT(DISTINCT lp.vid)::INTEGER as visitors,
        COUNT(CASE WHEN b.sid IS NOT NULL THEN 1 END)::INTEGER as bounces,
        ROUND(
          COUNT(CASE WHEN b.sid IS NOT NULL THEN 1 END)::NUMERIC / 
          NULLIF(COUNT(DISTINCT lp.sid), 0)::NUMERIC * 100, 
          2
        ) as bounce_rate,
        COUNT(CASE WHEN c.sid IS NOT NULL THEN 1 END)::INTEGER as conversions,
        ROUND(
          COUNT(CASE WHEN c.sid IS NOT NULL THEN 1 END)::NUMERIC / 
          NULLIF(COUNT(DISTINCT lp.sid), 0)::NUMERIC * 100, 
          2
        ) as conversion_rate,
        COALESCE(SUM(c.revenue), 0)::NUMERIC as revenue,
        CASE 
          WHEN COUNT(DISTINCT lp.vid) > 0 THEN
            ROUND(COALESCE(SUM(c.revenue), 0) / COUNT(DISTINCT lp.vid)::NUMERIC, 2)
          ELSE 0
        END as revenue_per_visitor
      FROM landing_pages lp
      LEFT JOIN conversions c ON lp.sid = c.sid
      LEFT JOIN bounces b ON lp.sid = b.sid
      GROUP BY lp.landing_path
      ORDER BY conversions DESC, sessions DESC
      LIMIT 50
      `,
      [site.id, start, end]
    );

    return NextResponse.json({ landingPages: result.rows });
  } catch (error) {
    console.error('Error fetching landing page performance:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


