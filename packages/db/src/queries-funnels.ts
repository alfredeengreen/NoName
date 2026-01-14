import { getPool } from './index';
import type { TimeRange } from '@analytics/shared';

export interface FunnelStepEvent {
  sid: string;
  vid: string;
  events: Array<{
    eventName: string | null;
    eventType: string;
    path: string;
    timestamp: Date;
    props?: Record<string, any>;
  }>;
}

/**
 * Get events that occurred during each funnel step, grouped by session
 */
export async function getFunnelStepEvents(
  siteId: string,
  steps: Array<{ type: 'page' | 'event'; value: string; name?: string }>,
  stepIndex: number,
  timeRange: TimeRange
): Promise<FunnelStepEvent[]> {
  if (stepIndex < 0 || stepIndex >= steps.length) {
    return [];
  }

  const pool = getPool();

  // Build SQL to find step timestamps - use parameterized query with correct indices
  const stepQueries = steps.map((step, i) => {
    // Parameters: $1=siteId, $2=start, $3=end, $4=$5=$6...=step values
    const paramIndex = i + 4;
    if (step.type === 'page') {
      return `
        MIN(CASE WHEN path = $${paramIndex} AND event_type = 'inc' AND event_name IS NULL THEN ts END) as step${i}_ts
      `;
    } else {
      return `
        MIN(CASE WHEN event_type = 'event' AND event_name = $${paramIndex} THEN ts END) as step${i}_ts
      `;
    }
  }).join(',');

  const params = [siteId, timeRange.start, timeRange.end, ...steps.map((s) => s.value)];

  // Get events that occurred between stepIndex and stepIndex+1 (or after last step)
  const result = await pool.query(`
    WITH session_steps AS (
      SELECT 
        sid,
        vid,
        ${stepQueries}
      FROM events_raw
      WHERE site_id = $1
        AND ts >= $2
        AND ts <= $3
      GROUP BY sid, vid
    ),
    sessions_with_step AS (
      SELECT sid, vid, step${stepIndex}_ts as step_start_ts,
        ${stepIndex < steps.length - 1 
          ? `step${stepIndex + 1}_ts as step_end_ts`
          : `NULL as step_end_ts`
        }
      FROM session_steps
      WHERE step${stepIndex}_ts IS NOT NULL
    ),
    step_events AS (
      SELECT 
        sws.sid,
        sws.vid,
        er.event_name,
        er.event_type,
        er.path,
        er.ts,
        er.props
      FROM sessions_with_step sws
      JOIN events_raw er ON er.sid = sws.sid
      WHERE er.site_id = $1
        AND er.ts >= sws.step_start_ts
        AND (sws.step_end_ts IS NULL OR er.ts < sws.step_end_ts)
        AND er.ts >= $2
        AND er.ts <= $3
      ORDER BY sws.sid, er.ts
    )
    SELECT 
      sid,
      vid,
      json_agg(
        json_build_object(
          'eventName', event_name,
          'eventType', event_type,
          'path', path,
          'timestamp', ts,
          'props', COALESCE(props, '{}'::jsonb)
        ) ORDER BY ts
      ) as events
    FROM step_events
    GROUP BY sid, vid
    ORDER BY sid
    LIMIT 100
  `, params);

  return result.rows.map((r: any) => ({
    sid: r.sid,
    vid: r.vid,
    events: (r.events || []).map((e: any) => ({
      eventName: e.eventName,
      eventType: e.eventType,
      path: e.path,
      timestamp: new Date(e.timestamp),
      props: e.props || {},
    })),
  }));
}

/**
 * Get element contributions for each funnel step
 * Identifies which elements help or hurt progression between steps
 */
export async function getFunnelElementContributions(
  siteId: string,
  steps: Array<{ type: 'page' | 'event'; value: string; name?: string }>,
  stepIndex: number,
  timeRange: TimeRange
): Promise<{
  topPositive: Array<{
    elementId: string;
    label?: string;
    role?: string;
    sessionsAtStep: number;
    sessionsAtNextStep: number;
    progressionRate: number;
    lift: number;
    events: {
      exposures: number;
      clicks: number;
      conversions: number;
      exits: number;
    };
  }>;
  topNegative: Array<{
    elementId: string;
    label?: string;
    role?: string;
    sessionsAtStep: number;
    sessionsAtNextStep: number;
    progressionRate: number;
    lift: number;
    events: {
      exposures: number;
      clicks: number;
      conversions: number;
      exits: number;
    };
  }>;
}> {
  if (stepIndex < 0 || stepIndex >= steps.length - 1) {
    return { topPositive: [], topNegative: [] };
  }

  const pool = getPool();

  // Build step queries
  const stepQueries = steps.map((step, i) => {
    if (step.type === 'page') {
      return `
        MIN(CASE WHEN path = $${i + 4} AND event_type = 'inc' AND event_name IS NULL THEN ts END) as step${i}_ts
      `;
    } else {
      return `
        MIN(CASE WHEN event_type = 'event' AND event_name = $${i + 4} THEN ts END) as step${i}_ts
      `;
    }
  }).join(',');

  const params = [siteId, timeRange.start, timeRange.end, ...steps.map((s) => s.value)];

  // Build column references dynamically
  const currentStepCol = `step${stepIndex}_ts`;
  const nextStepCol = `step${stepIndex + 1}_ts`;

  // Get element contributions
  const result = await pool.query(`
    WITH session_steps AS (
      SELECT 
        sid,
        vid,
        ${stepQueries}
      FROM events_raw
      WHERE site_id = $1
        AND ts >= $2
        AND ts <= $3
      GROUP BY sid, vid
    ),
    sessions_at_step AS (
      SELECT sid
      FROM session_steps
      WHERE ${currentStepCol} IS NOT NULL
    ),
    sessions_at_next_step AS (
      SELECT sid
      FROM session_steps
      WHERE ${currentStepCol} IS NOT NULL
        AND ${nextStepCol} IS NOT NULL
    ),
    element_clicks AS (
      SELECT 
        e.sid,
        e.props->>'elementId' as element_id,
        e.ts
      FROM events_raw e
      INNER JOIN sessions_at_step s ON s.sid = e.sid
      INNER JOIN session_steps ss ON ss.sid = e.sid
      WHERE e.site_id = $1
        AND e.ts >= $2
        AND e.ts <= $3
        AND e.event_type = 'event'
        AND e.event_name = 'click'
        AND e.props->>'elementId' IS NOT NULL
        AND e.ts >= ss.${currentStepCol}
        AND (ss.${nextStepCol} IS NULL OR e.ts < ss.${nextStepCol})
    ),
    element_stats AS (
      SELECT 
        ec.element_id,
        COUNT(DISTINCT ec.sid)::INTEGER as sessions_with_element,
        COUNT(DISTINCT CASE WHEN s2.sid IS NOT NULL THEN ec.sid END)::INTEGER as sessions_progressed,
        COUNT(*)::INTEGER as total_clicks
      FROM element_clicks ec
      LEFT JOIN sessions_at_next_step s2 ON s2.sid = ec.sid
      GROUP BY ec.element_id
    ),
    baseline_progression AS (
      SELECT 
        COUNT(DISTINCT s1.sid)::INTEGER as total_at_step,
        COUNT(DISTINCT s2.sid)::INTEGER as total_progressed
      FROM sessions_at_step s1
      LEFT JOIN sessions_at_next_step s2 ON s2.sid = s1.sid
    )
    SELECT 
      es.element_id,
      es.sessions_with_element,
      es.sessions_progressed,
      es.total_clicks,
      bp.total_at_step,
      bp.total_progressed,
      CASE 
        WHEN es.sessions_with_element > 0 
        THEN (es.sessions_progressed::NUMERIC / es.sessions_with_element) 
        ELSE 0 
      END as element_progression_rate,
      CASE 
        WHEN bp.total_at_step > 0 
        THEN (bp.total_progressed::NUMERIC / bp.total_at_step) 
        ELSE 0 
      END as baseline_progression_rate
    FROM element_stats es
    CROSS JOIN baseline_progression bp
    WHERE es.sessions_with_element >= 5
    ORDER BY es.sessions_with_element DESC
    LIMIT 20
  `, params);

  // Get element metadata
  const elementIds = result.rows.map((r: any) => r.element_id).filter(Boolean);
  let metadataMap = new Map();
  if (elementIds.length > 0) {
    const metadataQuery = `
      SELECT element_id, label, role
      FROM element_metadata
      WHERE site_id = $1 AND element_id = ANY($2)
    `;
    const metadataResult = await pool.query(metadataQuery, [siteId, elementIds]);
    metadataMap = new Map(
      metadataResult.rows.map((r: any) => [r.element_id, { label: r.label, role: r.role }])
    );
  }

  // Calculate lift and categorize
  const positive: any[] = [];
  const negative: any[] = [];

  for (const row of result.rows) {
    const elementId = row.element_id;
    const sessionsAtStep = Number(row.sessions_with_element || 0);
    const sessionsAtNextStep = Number(row.sessions_progressed || 0);
    const elementProgressionRate = Number(row.element_progression_rate || 0);
    const baselineProgressionRate = Number(row.baseline_progression_rate || 0);
    const lift = elementProgressionRate - baselineProgressionRate;

    const metadata = metadataMap.get(elementId) || {};

    const elementData = {
      elementId,
      label: metadata.label,
      role: metadata.role,
      sessionsAtStep,
      sessionsAtNextStep,
      progressionRate: elementProgressionRate,
      lift,
      events: {
        exposures: sessionsAtStep, // Approximate
        clicks: Number(row.total_clicks || 0),
        conversions: 0, // Not tracked in this query
        exits: 0, // Not tracked in this query
      },
    };

    if (lift > 0) {
      positive.push(elementData);
    } else if (lift < 0) {
      negative.push(elementData);
    }
  }

  // Sort and limit
  positive.sort((a, b) => b.lift - a.lift);
  negative.sort((a, b) => a.lift - b.lift);

  return {
    topPositive: positive.slice(0, 5),
    topNegative: negative.slice(0, 5),
  };
}

