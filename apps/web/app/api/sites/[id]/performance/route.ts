import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@analytics/db';
import { getCoreWebVitalsTrends, getResourcePerformance, getPerformanceErrorCorrelation } from '@analytics/db/src/queries';
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
    const start = searchParams.get('start') ? new Date(searchParams.get('start')!) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const end = searchParams.get('end') ? new Date(searchParams.get('end')!) : new Date();
    const type = searchParams.get('type') || 'api';

    const pool = getPool();

    // Get slowest endpoints
    const slowestResult = await pool.query(
      `
      SELECT 
        name,
        AVG(duration)::INTEGER as avg_duration,
        MAX(duration)::INTEGER as max_duration,
        MIN(duration)::INTEGER as min_duration,
        COUNT(*)::INTEGER as count,
        COUNT(CASE WHEN status >= 400 THEN 1 END)::INTEGER as error_count
      FROM performance_metrics
      WHERE site_id = $1
        AND type = $2
        AND ts >= $3
        AND ts <= $4
      GROUP BY name
      ORDER BY avg_duration DESC
      LIMIT 20
      `,
      [site.id, type, start, end]
    );

    // Get error rates by endpoint
    const errorRatesResult = await pool.query(
      `
      SELECT 
        name,
        COUNT(*)::INTEGER as total,
        COUNT(CASE WHEN status >= 400 OR status = 0 THEN 1 END)::INTEGER as errors,
        ROUND(COUNT(CASE WHEN status >= 400 OR status = 0 THEN 1 END)::NUMERIC / COUNT(*)::NUMERIC * 100, 2) as error_rate
      FROM performance_metrics
      WHERE site_id = $1
        AND type = $2
        AND ts >= $3
        AND ts <= $4
      GROUP BY name
      HAVING COUNT(*) > 10
      ORDER BY error_rate DESC
      LIMIT 20
      `,
      [site.id, type, start, end]
    );

    // Get performance trends over time
    const trendsResult = await pool.query(
      `
      SELECT 
        DATE_TRUNC('hour', ts) as hour,
        AVG(duration)::INTEGER as avg_duration,
        COUNT(*)::INTEGER as count
      FROM performance_metrics
      WHERE site_id = $1
        AND type = $2
        AND ts >= $3
        AND ts <= $4
      GROUP BY DATE_TRUNC('hour', ts)
      ORDER BY hour ASC
      `,
      [site.id, type, start, end]
    );

    const timeRange = { start, end };
    const [coreWebVitals, resourcePerformance, errorCorrelation] = await Promise.all([
      getCoreWebVitalsTrends(site.id, timeRange).catch(() => []),
      getResourcePerformance(site.id, timeRange, 20).catch(() => []),
      getPerformanceErrorCorrelation(site.id, timeRange).catch(() => []),
    ]);

    return NextResponse.json({
      slowest: Array.isArray(slowestResult.rows) ? slowestResult.rows : [],
      errorRates: Array.isArray(errorRatesResult.rows) ? errorRatesResult.rows : [],
      trends: Array.isArray(trendsResult.rows) ? trendsResult.rows : [],
      coreWebVitals: Array.isArray(coreWebVitals) ? coreWebVitals : [],
      resourcePerformance: Array.isArray(resourcePerformance) ? resourcePerformance : [],
      errorCorrelation: Array.isArray(errorCorrelation) ? errorCorrelation : [],
    });
  } catch (error) {
    console.error('Error fetching performance data:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

