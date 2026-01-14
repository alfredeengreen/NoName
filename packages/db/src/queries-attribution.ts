import { getPool } from './client';

export interface TimeRange {
  start: Date;
  end: Date;
}

export type AttributionModel = 'first_touch' | 'last_touch' | 'linear' | 'time_decay' | 'position_based' | 'data_driven';

export interface AttributionDataPoint {
  channel: string;
  sessions: number;
  conversions: number;
  revenue: number;
  conversionRate: number;
  conversionShare: number;
  revenueShare: number;
}

/**
 * Get attribution analysis data
 */
export async function getAttributionData(
  siteId: string,
  timeRange: TimeRange,
  model: AttributionModel = 'last_touch',
  conversionEvent?: string
): Promise<AttributionDataPoint[]> {
  const pool = getPool();
  
  // For now, implement last_touch attribution
  // Other models can be added later
  const result = await pool.query(`
    WITH all_sessions AS (
      SELECT DISTINCT sid
      FROM events_raw
      WHERE site_id = $1
        AND ts >= $2
        AND ts <= $3
    ),
    conversion_sessions AS (
      SELECT DISTINCT sid
      FROM events_raw
      WHERE site_id = $1
        AND ts >= $2
        AND ts <= $3
        AND event_type = 'event'
        ${conversionEvent ? `AND event_name = $4` : `AND event_name = 'purchase'`}
    ),
    session_channels AS (
      SELECT 
        er.sid,
        COALESCE(er.utm_source, er.ref_domain, 'direct') as channel,
        er.ts,
        ROW_NUMBER() OVER (PARTITION BY er.sid ORDER BY er.ts DESC) as rn
      FROM events_raw er
      WHERE er.site_id = $1
        AND er.ts >= $2
        AND er.ts <= $3
    ),
    channel_sessions AS (
      SELECT 
        channel,
        COUNT(DISTINCT sid)::INTEGER as sessions
      FROM session_channels sc
      WHERE sc.rn = 1
      GROUP BY channel
    ),
    attributed_conversions AS (
      SELECT 
        channel,
        COUNT(DISTINCT cs.sid)::INTEGER as conversions,
        SUM(COALESCE(er.value::NUMERIC, 0))::NUMERIC as revenue
      FROM session_channels sc
      JOIN conversion_sessions cs ON sc.sid = cs.sid
      JOIN events_raw er ON cs.sid = er.sid
        AND er.event_type = 'event'
        ${conversionEvent ? `AND er.event_name = $4` : `AND er.event_name = 'purchase'`}
      WHERE sc.rn = 1
        AND er.site_id = $1
        AND er.ts >= $2
        AND er.ts <= $3
      GROUP BY channel
    )
    SELECT 
      COALESCE(cs.channel, ac.channel) as channel,
      COALESCE(cs.sessions, 0)::INTEGER as sessions,
      COALESCE(ac.conversions, 0)::INTEGER as conversions,
      COALESCE(ac.revenue, 0)::NUMERIC as revenue,
      CASE 
        WHEN COALESCE(cs.sessions, 0) > 0 
        THEN (COALESCE(ac.conversions, 0)::NUMERIC / cs.sessions) * 100 
        ELSE 0 
      END as conversion_rate,
      (CAST(COALESCE(ac.conversions, 0) AS NUMERIC) / NULLIF(SUM(COALESCE(ac.conversions, 0)) OVER (), 0)) * 100 as conversion_share,
      (CAST(COALESCE(ac.revenue, 0) AS NUMERIC) / NULLIF(SUM(COALESCE(ac.revenue, 0)) OVER (), 0)) * 100 as revenue_share
    FROM channel_sessions cs
    FULL OUTER JOIN attributed_conversions ac ON cs.channel = ac.channel
    ORDER BY conversions DESC
  `, conversionEvent ? [siteId, timeRange.start, timeRange.end, conversionEvent] : [siteId, timeRange.start, timeRange.end]);

  return result.rows.map((r: any) => ({
    channel: r.channel || 'Unknown',
    sessions: Number(r.sessions || 0),
    conversions: Number(r.conversions || 0),
    revenue: Number(r.revenue || 0),
    conversionRate: Number(r.conversion_rate || 0),
    conversionShare: Number(r.conversion_share || 0),
    revenueShare: Number(r.revenue_share || 0),
  }));
}

/**
 * Compare all attribution models side-by-side
 */
export async function compareAttributionModels(
  siteId: string,
  timeRange: TimeRange,
  conversionEvent: string = 'purchase'
): Promise<Record<AttributionModel, AttributionDataPoint[]>> {
  const models: AttributionModel[] = ['first_touch', 'last_touch', 'linear', 'time_decay', 'position_based'];
  
  const results = await Promise.all(
    models.map(async (model) => ({
      model,
      data: await getAttributionData(siteId, timeRange, model, conversionEvent),
    }))
  );

  const comparison: Record<string, AttributionDataPoint[]> = {};
  results.forEach(({ model, data }) => {
    comparison[model] = data;
  });

  return comparison as Record<AttributionModel, AttributionDataPoint[]>;
}

/**
 * Get attribution paths (multi-touch sequences)
 */
export async function getAttributionPaths(
  siteId: string,
  timeRange: TimeRange,
  conversionEvent: string = 'purchase',
  limit: number = 20
) {
  const pool = getPool();
  
  const result = await pool.query(`
    WITH conversion_sessions AS (
      SELECT DISTINCT sid
      FROM events_raw
      WHERE site_id = $1
        AND ts >= $2
        AND ts <= $3
        AND event_type = 'event'
        AND event_name = $4
    ),
    session_touchpoints AS (
      SELECT 
        er.sid,
        COALESCE(er.utm_source, er.ref_domain, 'direct') as channel,
        er.ts,
        ROW_NUMBER() OVER (PARTITION BY er.sid ORDER BY er.ts ASC) as touchpoint_order
      FROM events_raw er
      WHERE er.site_id = $1
        AND er.ts >= $2
        AND er.ts <= $3
        AND er.sid IN (SELECT sid FROM conversion_sessions)
    ),
    path_sequences AS (
      SELECT 
        sid,
        array_agg(channel ORDER BY touchpoint_order) as path,
        COUNT(*)::INTEGER as touchpoint_count
      FROM session_touchpoints
      GROUP BY sid
    )
    SELECT 
      path,
      COUNT(*)::INTEGER as conversion_count,
      AVG(touchpoint_count)::NUMERIC as avg_touchpoints
    FROM path_sequences
    GROUP BY path
    ORDER BY conversion_count DESC
    LIMIT $5
  `, [siteId, timeRange.start, timeRange.end, conversionEvent, limit]);

  return result.rows.map((r: any) => ({
    path: r.path || [],
    conversionCount: Number(r.conversion_count),
    avgTouchpoints: Math.round(Number(r.avg_touchpoints) * 100) / 100,
  }));
}

/**
 * Get time to conversion from first touch
 */
export async function getTimeToConversionFromFirstTouch(
  siteId: string,
  timeRange: TimeRange,
  conversionEvent: string = 'purchase'
) {
  const pool = getPool();
  
  const result = await pool.query(`
    WITH conversion_sessions AS (
      SELECT DISTINCT sid, MIN(ts) as conversion_time
      FROM events_raw
      WHERE site_id = $1
        AND ts >= $2
        AND ts <= $3
        AND event_type = 'event'
        AND event_name = $4
      GROUP BY sid
    ),
    first_touchpoints AS (
      SELECT DISTINCT ON (er.sid)
        er.sid,
        er.ts as first_touch_time
      FROM events_raw er
      WHERE er.site_id = $1
        AND er.ts >= $2
        AND er.ts <= $3
        AND er.sid IN (SELECT sid FROM conversion_sessions)
      ORDER BY er.sid, er.ts ASC
    )
    SELECT 
      AVG(EXTRACT(EPOCH FROM (cs.conversion_time - ft.first_touch_time)) / 3600)::NUMERIC as avg_hours,
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (cs.conversion_time - ft.first_touch_time)) / 3600)::NUMERIC as median_hours,
      MIN(EXTRACT(EPOCH FROM (cs.conversion_time - ft.first_touch_time)) / 3600)::NUMERIC as min_hours,
      MAX(EXTRACT(EPOCH FROM (cs.conversion_time - ft.first_touch_time)) / 3600)::NUMERIC as max_hours
    FROM conversion_sessions cs
    JOIN first_touchpoints ft ON cs.sid = ft.sid
  `, [siteId, timeRange.start, timeRange.end, conversionEvent]);

  if (result.rows.length === 0 || !result.rows[0].avg_hours) {
    return {
      avgHours: 0,
      medianHours: 0,
      minHours: 0,
      maxHours: 0,
    };
  }

  const r = result.rows[0];
  return {
    avgHours: Math.round(Number(r.avg_hours) * 100) / 100,
    medianHours: Math.round(Number(r.median_hours) * 100) / 100,
    minHours: Math.round(Number(r.min_hours) * 100) / 100,
    maxHours: Math.round(Number(r.max_hours) * 100) / 100,
  };
}

/**
 * Get touchpoint frequency distribution
 */
export async function getTouchpointFrequency(
  siteId: string,
  timeRange: TimeRange,
  conversionEvent: string = 'purchase'
) {
  const pool = getPool();
  
  const result = await pool.query(`
    WITH conversion_sessions AS (
      SELECT DISTINCT sid
      FROM events_raw
      WHERE site_id = $1
        AND ts >= $2
        AND ts <= $3
        AND event_type = 'event'
        AND event_name = $4
    ),
    session_touchpoints AS (
      SELECT 
        er.sid,
        COUNT(DISTINCT COALESCE(er.utm_source, er.ref_domain, 'direct'))::INTEGER as touchpoint_count
      FROM events_raw er
      WHERE er.site_id = $1
        AND er.ts >= $2
        AND er.ts <= $3
        AND er.sid IN (SELECT sid FROM conversion_sessions)
      GROUP BY er.sid
    )
    SELECT 
      touchpoint_count,
      COUNT(*)::INTEGER as session_count
    FROM session_touchpoints
    GROUP BY touchpoint_count
    ORDER BY touchpoint_count
  `, [siteId, timeRange.start, timeRange.end, conversionEvent]);

  return result.rows.map((r: any) => ({
    touchpointCount: Number(r.touchpoint_count),
    sessionCount: Number(r.session_count),
  }));
}

