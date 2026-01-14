import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@analytics/db';
import { verifySiteAccess } from '@/lib/auth-helpers';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; eventName: string } }
) {
  try {
    const { authorized, site } = await verifySiteAccess(params.id);
    if (!authorized || !site) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const pool = getPool();
    const siteId = site.id;
    const eventName = decodeURIComponent(params.eventName);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 7);

    // Try to get from events_raw first (for named events)
    const eventsRawResult = await pool.query(`
      SELECT 
        path,
        COUNT(*)::INTEGER as count,
        COUNT(DISTINCT vid)::INTEGER as unique_visitors,
        SUM(COALESCE(value, 0))::NUMERIC as total_value
      FROM events_raw
      WHERE site_id = $1 
        AND COALESCE(event_name, CASE WHEN event_type = 'inc' THEN 'pageview' ELSE 'unknown' END) = $2
        AND ts >= $3
      GROUP BY path
    `, [siteId, eventName, cutoffDate]);

    // Also try to get from rollup_minute (for increment events like clicks, scrolls)
    const rollupResult = await pool.query(`
      SELECT 
        path,
        SUM(count)::INTEGER as count,
        0::INTEGER as unique_visitors, -- Can't get unique visitors from rollup_minute easily
        0::NUMERIC as total_value
      FROM rollup_minute
      WHERE site_id = $1 
        AND event_key = $2
        AND minute_ts >= $3
      GROUP BY path
    `, [siteId, eventName, cutoffDate]);

    // Merge results by path
    const detailsMap = new Map<string, { count: number; uniqueVisitors: number; totalValue: number }>();

    // Add events_raw results
    for (const row of eventsRawResult.rows) {
      detailsMap.set(row.path, {
        count: Number(row.count),
        uniqueVisitors: Number(row.unique_visitors),
        totalValue: Number(row.total_value || 0),
      });
    }

    // Add rollup_minute results (merge if path exists)
    for (const row of rollupResult.rows) {
      const existing = detailsMap.get(row.path);
      if (existing) {
        existing.count += Number(row.count);
      } else {
        detailsMap.set(row.path, {
          count: Number(row.count),
          uniqueVisitors: 0, // Can't get unique visitors from rollup_minute
          totalValue: 0,
        });
      }
    }

    // Convert to array and sort by count
    const details = Array.from(detailsMap.entries())
      .map(([path, data]) => ({
        path,
        count: data.count,
        uniqueVisitors: data.uniqueVisitors,
        totalValue: data.totalValue,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 50);

    return NextResponse.json({ details });
  } catch (error) {
    console.error('Error fetching event details:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

