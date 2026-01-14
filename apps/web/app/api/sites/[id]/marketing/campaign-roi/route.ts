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

    // Get campaign performance with ROI
    const result = await pool.query(
      `
      SELECT 
        c.id,
        c.name,
        c.utm_campaign,
        c.cost::NUMERIC as cost,
        COUNT(DISTINCT e.vid)::INTEGER as visitors,
        COUNT(DISTINCT e.sid)::INTEGER as sessions,
        COUNT(CASE WHEN e.event_name = 'purchase' THEN 1 END)::INTEGER as conversions,
        SUM(CASE WHEN e.event_name = 'purchase' THEN COALESCE(e.value, 0) ELSE 0 END)::NUMERIC as revenue,
        CASE 
          WHEN c.cost > 0 THEN 
            ROUND((SUM(CASE WHEN e.event_name = 'purchase' THEN COALESCE(e.value, 0) ELSE 0 END) - c.cost) / c.cost * 100, 2)
          ELSE NULL
        END as roi_percent,
        CASE 
          WHEN COUNT(CASE WHEN e.event_name = 'purchase' THEN 1 END) > 0 AND c.cost > 0 THEN
            ROUND(c.cost / COUNT(CASE WHEN e.event_name = 'purchase' THEN 1 END)::NUMERIC, 2)
          ELSE NULL
        END as cpa,
        CASE 
          WHEN COUNT(DISTINCT e.vid) > 0 THEN
            ROUND(SUM(CASE WHEN e.event_name = 'purchase' THEN COALESCE(e.value, 0) ELSE 0 END) / COUNT(DISTINCT e.vid)::NUMERIC, 2)
          ELSE 0
        END as revenue_per_visitor
      FROM campaigns c
      LEFT JOIN events_raw e ON 
        e.site_id = c.site_id
        AND e.ts >= $2
        AND e.ts <= $3
        AND (
          (c.utm_campaign IS NOT NULL AND e.utm_campaign = c.utm_campaign) OR
          (c.utm_source IS NOT NULL AND e.utm_source = c.utm_source) OR
          (c.utm_medium IS NOT NULL AND e.utm_medium = c.utm_medium)
        )
      WHERE c.site_id = $1
        AND (c.start_date IS NULL OR c.start_date <= $3::DATE)
        AND (c.end_date IS NULL OR c.end_date >= $2::DATE)
      GROUP BY c.id, c.name, c.utm_campaign, c.cost
      ORDER BY revenue DESC
      `,
      [site.id, start, end]
    );

    return NextResponse.json({ campaigns: result.rows });
  } catch (error) {
    console.error('Error fetching campaign ROI:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


