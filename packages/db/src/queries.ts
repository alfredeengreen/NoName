import { eq, and, gte, lte, desc, asc, sql, count, sum } from 'drizzle-orm';
import { getDb, getPool } from './client';
import { eventsRaw, rollupMinute, ingestStats, goals, ecommerceItems, customDimensions, calculatedMetrics, segments } from './schema';
import { FilterConfig, applyFilters } from '@analytics/shared';

export interface TimeRange {
  start: Date;
  end: Date;
}

export interface RollupDataPoint {
  time: Date;
  count: number;
  valueSum: number | null;
}

/**
 * Get rollup data aggregated by time bucket
 */
export async function getRollupData(
  siteId: string,
  timeRange: TimeRange,
  eventKeyFilter?: string
): Promise<RollupDataPoint[]> {
  const db = getDb();

  const conditions = [
    eq(rollupMinute.siteId, siteId),
    gte(rollupMinute.minuteTs, timeRange.start),
    lte(rollupMinute.minuteTs, timeRange.end),
  ];

  if (eventKeyFilter) {
    conditions.push(eq(rollupMinute.eventKey, eventKeyFilter));
  }

  const results = await db
    .select({
      time: rollupMinute.minuteTs,
      count: sum(rollupMinute.count),
      valueSum: sum(rollupMinute.valueSum),
    })
    .from(rollupMinute)
    .where(and(...conditions))
    .groupBy(rollupMinute.minuteTs)
    .orderBy(asc(rollupMinute.minuteTs));

  return results.map((r) => ({
    time: r.time,
    count: Number(r.count || 0),
    valueSum: r.valueSum ? Number(r.valueSum) : null,
  }));
}

/**
 * Get form submission data aggregated by time bucket (all form_submit:* events)
 */
export async function getFormSubmitData(
  siteId: string,
  timeRange: TimeRange
): Promise<RollupDataPoint[]> {
  const pool = getPool();
  
  const result = await pool.query(`
    SELECT 
      minute_ts as time,
      SUM(count)::INTEGER as count,
      SUM(value_sum)::NUMERIC as value_sum
    FROM rollup_minute
    WHERE site_id = $1
      AND minute_ts >= $2
      AND minute_ts <= $3
      AND event_key LIKE 'form_submit:%'
    GROUP BY minute_ts
    ORDER BY minute_ts ASC
  `, [siteId, timeRange.start, timeRange.end]);

  return result.rows.map((r: any) => ({
    time: new Date(r.time),
    count: Number(r.count || 0),
    valueSum: r.value_sum ? Number(r.value_sum) : null,
  }));
}

/**
 * Get event catalog (distinct event names from last N days)
 * Includes both named events from events_raw and increment events (clicks, scrolls) from rollup_minute
 */
export async function getEventCatalog(siteId: string, days: number = 7) {
  const pool = getPool();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  // Get named events from events_raw
  const namedEventsResult = await pool.query(`
    SELECT 
      COALESCE(event_name, 'pageview') as event_name,
      COUNT(*)::INTEGER as count,
      MAX(ts) as last_seen
    FROM events_raw
    WHERE site_id = $1 AND ts >= $2
      AND (event_type = 'event' OR (event_type = 'inc' AND event_name IS NULL))
    GROUP BY COALESCE(event_name, 'pageview')
  `, [siteId, cutoffDate]);

  // Get increment events from rollup_minute (clicks, scrolls, form_submits, etc.)
  // These are events with event_key like "click:button", "scroll:25", etc.
  const incrementEventsResult = await pool.query(`
    SELECT 
      event_key as event_name,
      SUM(count)::INTEGER as count,
      MAX(minute_ts) as last_seen
    FROM rollup_minute
    WHERE site_id = $1 AND minute_ts >= $2
      AND event_key NOT LIKE 'pv:%'
      AND event_key NOT LIKE 'pageview%'
    GROUP BY event_key
  `, [siteId, cutoffDate]);

  // Combine and merge results
  const eventMap = new Map<string, { count: number; lastSeen: Date }>();

  // Add named events
  for (const row of namedEventsResult.rows) {
    const eventName = row.event_name;
    const existing = eventMap.get(eventName);
    if (existing) {
      existing.count += Number(row.count);
      const lastSeen = new Date(row.last_seen);
      if (lastSeen > existing.lastSeen) {
        existing.lastSeen = lastSeen;
      }
    } else {
      eventMap.set(eventName, {
        count: Number(row.count),
        lastSeen: new Date(row.last_seen),
      });
    }
  }

  // Add increment events (clicks, scrolls, etc.)
  for (const row of incrementEventsResult.rows) {
    const eventName = row.event_name;
    const existing = eventMap.get(eventName);
    if (existing) {
      existing.count += Number(row.count);
      const lastSeen = new Date(row.last_seen);
      if (lastSeen > existing.lastSeen) {
        existing.lastSeen = lastSeen;
      }
    } else {
      eventMap.set(eventName, {
        count: Number(row.count),
        lastSeen: new Date(row.last_seen),
      });
    }
  }

  // Convert to array and sort by count
  return Array.from(eventMap.entries())
    .map(([eventName, data]) => ({
      eventName,
      count: data.count,
      lastSeen: data.lastSeen,
    }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Get event flows (sequence of events)
 */
export async function getEventFlows(
  siteId: string,
  timeRange: TimeRange,
  eventName: string,
  limit: number = 20
) {
  const pool = getPool();
  
  const result = await pool.query(`
    WITH target_events AS (
      SELECT DISTINCT sid, ts
      FROM events_raw
      WHERE site_id = $1
        AND ts >= $2
        AND ts <= $3
        AND event_type = 'event'
        AND event_name = $4
    ),
    event_sequences AS (
      SELECT 
        te.sid,
        array_agg(er.event_name ORDER BY er.ts) FILTER (
          WHERE er.event_type = 'event'
          AND er.ts <= te.ts
          AND er.ts >= te.ts - INTERVAL '1 hour'
        ) as before_events,
        array_agg(er.event_name ORDER BY er.ts) FILTER (
          WHERE er.event_type = 'event'
          AND er.ts > te.ts
          AND er.ts <= te.ts + INTERVAL '1 hour'
        ) as after_events
      FROM target_events te
      JOIN events_raw er ON er.sid = te.sid
      WHERE er.site_id = $1
        AND er.ts >= $2
        AND er.ts <= $3
      GROUP BY te.sid, te.ts
    )
    SELECT 
      before_events[array_length(before_events, 1)] as previous_event,
      after_events[1] as next_event,
      COUNT(*)::INTEGER as count
    FROM event_sequences
    WHERE array_length(before_events, 1) > 0 OR array_length(after_events, 1) > 0
    GROUP BY previous_event, next_event
    ORDER BY count DESC
    LIMIT $5
  `, [siteId, timeRange.start, timeRange.end, eventName, limit]);

  return result.rows.map((r: any) => ({
    previousEvent: r.previous_event || null,
    nextEvent: r.next_event || null,
    count: Number(r.count),
  }));
}

/**
 * Get event correlation analysis
 */
export async function getEventCorrelation(
  siteId: string,
  timeRange: TimeRange,
  eventName1: string,
  eventName2: string
) {
  const pool = getPool();
  
  const result = await pool.query(`
    WITH event1_sessions AS (
      SELECT DISTINCT sid
      FROM events_raw
      WHERE site_id = $1
        AND ts >= $2
        AND ts <= $3
        AND event_type = 'event'
        AND event_name = $4
    ),
    event2_sessions AS (
      SELECT DISTINCT sid
      FROM events_raw
      WHERE site_id = $1
        AND ts >= $2
        AND ts <= $3
        AND event_type = 'event'
        AND event_name = $5
    ),
    all_sessions AS (
      SELECT DISTINCT sid
      FROM events_raw
      WHERE site_id = $1
        AND ts >= $2
        AND ts <= $3
    )
    SELECT 
      COUNT(DISTINCT e1.sid)::INTEGER as event1_count,
      COUNT(DISTINCT e2.sid)::INTEGER as event2_count,
      COUNT(DISTINCT CASE WHEN e1.sid IS NOT NULL AND e2.sid IS NOT NULL THEN a.sid END)::INTEGER as both_count,
      COUNT(DISTINCT a.sid)::INTEGER as total_sessions
    FROM all_sessions a
    LEFT JOIN event1_sessions e1 ON a.sid = e1.sid
    LEFT JOIN event2_sessions e2 ON a.sid = e2.sid
  `, [siteId, timeRange.start, timeRange.end, eventName1, eventName2]);

  if (result.rows.length === 0) {
    return null;
  }

  const r = result.rows[0];
  const event1Count = Number(r.event1_count);
  const event2Count = Number(r.event2_count);
  const bothCount = Number(r.both_count);
  const totalSessions = Number(r.total_sessions);

  // Calculate correlation coefficient (simplified)
  const correlation = totalSessions > 0 && event1Count > 0 && event2Count > 0
    ? (bothCount / totalSessions) / ((event1Count / totalSessions) * (event2Count / totalSessions))
    : 0;

  return {
    event1: eventName1,
    event2: eventName2,
    event1Count,
    event2Count,
    bothCount,
    totalSessions,
    correlation: Math.round(correlation * 100) / 100,
  };
}

/**
 * Get event value distribution
 */
export async function getEventValueDistribution(
  siteId: string,
  timeRange: TimeRange,
  eventName: string
) {
  const pool = getPool();
  
  const result = await pool.query(`
    SELECT 
      COUNT(*)::INTEGER as total_events,
      COUNT(CASE WHEN value > 0 THEN 1 END)::INTEGER as events_with_value,
      SUM(COALESCE(value, 0))::NUMERIC as total_value,
      AVG(COALESCE(value, 0))::NUMERIC as avg_value,
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY COALESCE(value, 0))::NUMERIC as median_value,
      MIN(COALESCE(value, 0))::NUMERIC as min_value,
      MAX(COALESCE(value, 0))::NUMERIC as max_value,
      STDDEV(COALESCE(value, 0))::NUMERIC as stddev_value
    FROM events_raw
    WHERE site_id = $1
      AND ts >= $2
      AND ts <= $3
      AND event_type = 'event'
      AND event_name = $4
  `, [siteId, timeRange.start, timeRange.end, eventName]);

  if (result.rows.length === 0) {
    return null;
  }

  const r = result.rows[0];
  return {
    totalEvents: Number(r.total_events),
    eventsWithValue: Number(r.events_with_value),
    totalValue: Math.round(Number(r.total_value) * 100) / 100,
    avgValue: Math.round(Number(r.avg_value) * 100) / 100,
    medianValue: Math.round(Number(r.median_value) * 100) / 100,
    minValue: Math.round(Number(r.min_value) * 100) / 100,
    maxValue: Math.round(Number(r.max_value) * 100) / 100,
    stddevValue: Math.round(Number(r.stddev_value) * 100) / 100,
  };
}

/**
 * Get sessions list
 */
export async function getSessions(
  siteId: string,
  filters: { start?: Date; end?: Date } = {},
  pagination: { limit?: number; offset?: number } = {}
) {
  const db = getDb();

  const conditions = [eq(eventsRaw.siteId, siteId)];

  if (filters.start) {
    conditions.push(gte(eventsRaw.ts, filters.start));
  }
  if (filters.end) {
    conditions.push(lte(eventsRaw.ts, filters.end));
  }

  const results = await db
    .select({
      sid: eventsRaw.sid,
      startTime: sql<Date>`MIN(${eventsRaw.ts})`,
      endTime: sql<Date>`MAX(${eventsRaw.ts})`,
      pageviewCount: sql<number>`COUNT(CASE WHEN ${eventsRaw.eventType} = 'inc' AND ${eventsRaw.eventName} IS NULL THEN 1 END)`,
      entryPath: sql<string>`(array_agg(${eventsRaw.path} ORDER BY ${eventsRaw.ts} ASC))[1]`,
      utmSource: sql<string>`(array_agg(${eventsRaw.utmSource} ORDER BY ${eventsRaw.ts} ASC))[1]`,
      utmMedium: sql<string>`(array_agg(${eventsRaw.utmMedium} ORDER BY ${eventsRaw.ts} ASC))[1]`,
      utmCampaign: sql<string>`(array_agg(${eventsRaw.utmCampaign} ORDER BY ${eventsRaw.ts} ASC))[1]`,
      refDomain: sql<string>`(array_agg(${eventsRaw.refDomain} ORDER BY ${eventsRaw.ts} ASC))[1]`,
    })
    .from(eventsRaw)
    .where(and(...conditions))
    .groupBy(eventsRaw.sid)
    .orderBy(desc(sql`MIN(${eventsRaw.ts})`))
    .limit(pagination.limit || 50)
    .offset(pagination.offset || 0);

  return results.map((r) => ({
    sid: r.sid,
    startTime: r.startTime,
    endTime: r.endTime,
    duration: Math.floor((r.endTime.getTime() - r.startTime.getTime()) / 1000),
    pageviewCount: Number(r.pageviewCount),
    entryPath: r.entryPath,
    utm: {
      source: r.utmSource || undefined,
      medium: r.utmMedium || undefined,
      campaign: r.utmCampaign || undefined,
    },
    refDomain: r.refDomain || undefined,
  }));
}

/**
 * Get session detail (all events for a session)
 */
export async function getSessionDetail(siteId: string, sid: string) {
  const db = getDb();

  const results = await db
    .select()
    .from(eventsRaw)
    .where(and(eq(eventsRaw.siteId, siteId), eq(eventsRaw.sid, sid)))
    .orderBy(asc(eventsRaw.ts))
    .limit(500);

  return results;
}

/**
 * Get flexible funnel data with drop-off analysis
 */
export async function getFlexibleFunnelData(
  siteId: string,
  steps: Array<{ type: 'page' | 'event'; value: string; name?: string }>,
  timeRange: TimeRange
) {
  const pool = getPool();
  
  // Build SQL with dynamic step conditions
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

  const stepCounts = steps.map((_, i) => `
    COUNT(DISTINCT CASE WHEN step${i}_ts IS NOT NULL THEN sid END)::INTEGER as step${i}_count
  `).join(',');

  const params = [siteId, timeRange.start, timeRange.end, ...steps.map((s) => s.value)];

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
    funnel_counts AS (
      SELECT 
        ${stepCounts}
      FROM session_steps
    )
    SELECT * FROM funnel_counts
  `, params);

  if (result.rows.length === 0) {
    return {
      steps: steps.map((s, i) => ({
        step: i + 1,
        name: s.name || s.value,
        count: 0,
        rate: 0,
        dropOff: 0,
      })),
    };
  }

  const row = result.rows[0];
  const stepCountsArray = steps.map((_, i) => Number(row[`step${i}_count`] || 0));
  const firstStepCount = stepCountsArray[0] || 0;

  return {
    steps: steps.map((s, i) => ({
      step: i + 1,
      name: s.name || s.value,
      count: stepCountsArray[i],
      rate: firstStepCount > 0 ? (stepCountsArray[i] / firstStepCount) * 100 : 0,
      dropOff: i > 0 && stepCountsArray[i - 1] > 0 
        ? ((stepCountsArray[i - 1] - stepCountsArray[i]) / stepCountsArray[i - 1]) * 100 
        : 0,
    })),
  };
}

/**
 * Get time between funnel steps
 */
export async function getFunnelStepTiming(
  siteId: string,
  steps: Array<{ type: 'page' | 'event'; value: string; name?: string }>,
  timeRange: TimeRange
) {
  const pool = getPool();
  
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

  const result = await pool.query(`
    WITH session_steps AS (
      SELECT 
        sid,
        ${stepQueries}
      FROM events_raw
      WHERE site_id = $1
        AND ts >= $2
        AND ts <= $3
      GROUP BY sid
    )
    SELECT 
      ${steps.map((_, i) => i > 0 ? `
        AVG(EXTRACT(EPOCH FROM (step${i}_ts - step${i - 1}_ts)))::NUMERIC as step${i}_time
      ` : '').filter(Boolean).join(',')}
    FROM session_steps
    WHERE ${steps.map((_, i) => i > 0 ? `step${i}_ts IS NOT NULL AND step${i - 1}_ts IS NOT NULL` : '').filter(Boolean).join(' AND ')}
  `, params);

  if (result.rows.length === 0) {
    return steps.map((_, i) => i > 0 ? ({ fromStep: i, toStep: i + 1, avgSeconds: 0 }) : null).filter(Boolean);
  }

  const row = result.rows[0];
  return steps.map((_, i) => {
    if (i === 0) return null;
    return {
      fromStep: i,
      toStep: i + 1,
      avgSeconds: Math.round(Number(row[`step${i}_time`] || 0)),
    };
  }).filter(Boolean);
}

/**
 * Get drop-off destinations (where users go after dropping off)
 */
export async function getFunnelDropOffDestinations(
  siteId: string,
  steps: Array<{ type: 'page' | 'event'; value: string; name?: string }>,
  stepIndex: number,
  timeRange: TimeRange,
  limit: number = 10
) {
  if (stepIndex === 0 || stepIndex >= steps.length) {
    return [];
  }

  const pool = getPool();
  const stepQueries = steps.map((step, i) => {
    if (step.type === 'page') {
      return `
        MIN(CASE WHEN path = $${i + 5} AND event_type = 'inc' AND event_name IS NULL THEN ts END) as step${i}_ts
      `;
    } else {
      return `
        MIN(CASE WHEN event_type = 'event' AND event_name = $${i + 5} THEN ts END) as step${i}_ts
      `;
    }
  }).join(',');

  const params = [siteId, timeRange.start, timeRange.end, limit, ...steps.map((s) => s.value)];

  const result = await pool.query(`
    WITH session_steps AS (
      SELECT 
        sid,
        ${stepQueries}
      FROM events_raw
      WHERE site_id = $1
        AND ts >= $2
        AND ts <= $3
      GROUP BY sid
    ),
    drop_off_sessions AS (
      SELECT sid
      FROM session_steps
      WHERE step${stepIndex - 1}_ts IS NOT NULL
        AND step${stepIndex}_ts IS NULL
    ),
    next_actions AS (
      SELECT 
        e.path,
        COUNT(DISTINCT e.sid)::INTEGER as session_count
      FROM events_raw e
      JOIN drop_off_sessions dos ON e.sid = dos.sid
      WHERE e.site_id = $1
        AND e.ts >= $2
        AND e.ts <= $3
        AND e.ts > (
          SELECT step${stepIndex - 1}_ts FROM session_steps ss WHERE ss.sid = e.sid
        )
        AND e.ts < (
          SELECT step${stepIndex - 1}_ts FROM session_steps ss WHERE ss.sid = e.sid
        ) + INTERVAL '1 hour'
        AND e.event_type = 'inc'
        AND e.event_name IS NULL
      GROUP BY e.path
      ORDER BY session_count DESC
      LIMIT $4
    )
    SELECT * FROM next_actions
  `, params);

  return result.rows.map((r: any) => ({
    path: r.path,
    sessionCount: Number(r.session_count),
  }));
}

/**
 * Get funnel data
 */
export async function getFunnelData(
  siteId: string,
  steps: Array<{ kind: 'page' | 'event'; value: string }>,
  timeRange: TimeRange
) {
  const db = getDb();

  // Get all events in time range, ordered by session and time
  const allEvents = await db
    .select()
    .from(eventsRaw)
    .where(
      and(
        eq(eventsRaw.siteId, siteId),
        gte(eventsRaw.ts, timeRange.start),
        lte(eventsRaw.ts, timeRange.end)
      )
    )
    .orderBy(asc(eventsRaw.sid), asc(eventsRaw.ts));

  // Group by session and find step completions
  const sessionSteps: Record<string, number[]> = {};
  const stepCounts: number[] = new Array(steps.length).fill(0);

  let currentSid = '';
  let currentStepIndex = 0;

  for (const event of allEvents) {
    if (event.sid !== currentSid) {
      // New session
      currentSid = event.sid;
      currentStepIndex = 0;
      sessionSteps[currentSid] = [];
    }

    // Check if this event matches the current step we're looking for
    if (currentStepIndex < steps.length) {
      const step = steps[currentStepIndex];
      let matches = false;

      if (step.kind === 'page') {
        matches = event.path === step.value;
      } else if (step.kind === 'event') {
        matches = event.eventName === step.value;
      }

      if (matches) {
        sessionSteps[currentSid].push(currentStepIndex);
        if (currentStepIndex === sessionSteps[currentSid].length - 1) {
          stepCounts[currentStepIndex]++;
        }
        currentStepIndex++;
      }
    }
  }

  // Calculate conversion rates
  const conversions = stepCounts.map((count, index) => {
    const previousCount = index === 0 ? count : stepCounts[index - 1];
    const rate = previousCount > 0 ? (count / previousCount) * 100 : 0;
    return {
      step: index + 1,
      count,
      rate,
      dropOff: previousCount - count,
    };
  });

  return conversions;
}

/**
 * Get goal performance trends over time
 */
export async function getGoalPerformanceTrends(
  siteId: string,
  goalId: string,
  timeRange: TimeRange
) {
  const pool = getPool();
  const db = getDb();
  
  const goal = await db.select().from(goals).where(and(eq(goals.id, goalId), eq(goals.siteId, siteId))).limit(1);
  
  if (goal.length === 0) {
    return [];
  }

  const goalConfig = goal[0];
  let query = '';
  const params: any[] = [siteId, timeRange.start, timeRange.end];

  if (goalConfig.type === 'destination') {
    const config = goalConfig.config as { path?: string };
    query = `
      SELECT 
        DATE(ts) as date,
        COUNT(DISTINCT sid)::INTEGER as conversions,
        COUNT(DISTINCT vid)::INTEGER as unique_visitors
      FROM events_raw
      WHERE site_id = $1
        AND ts >= $2
        AND ts <= $3
        AND event_type = 'inc'
        AND path = $4
      GROUP BY DATE(ts)
      ORDER BY date ASC
    `;
    params.push(config.path || '');
  } else if (goalConfig.type === 'event') {
    const config = goalConfig.config as { eventName?: string };
    query = `
      SELECT 
        DATE(ts) as date,
        COUNT(DISTINCT sid)::INTEGER as conversions,
        COUNT(DISTINCT vid)::INTEGER as unique_visitors
      FROM events_raw
      WHERE site_id = $1
        AND ts >= $2
        AND ts <= $3
        AND event_type = 'event'
        AND event_name = $4
      GROUP BY DATE(ts)
      ORDER BY date ASC
    `;
    params.push(config.eventName || '');
  } else {
    return [];
  }

  const result = await pool.query(query, params);
  return result.rows.map((r: any) => ({
    date: r.date.toISOString().split('T')[0],
    conversions: Number(r.conversions),
    uniqueVisitors: Number(r.unique_visitors),
  }));
}


/**
 * Get ingest stats for time window
 */
export async function getIngestStats(siteId: string, minutes: number = 10) {
  const db = getDb();
  const cutoffTime = new Date();
  cutoffTime.setMinutes(cutoffTime.getMinutes() - minutes);

  const results = await db
    .select({
      acceptedCount: sum(ingestStats.acceptedCount),
      droppedInvalid: sum(ingestStats.droppedInvalid),
      droppedPii: sum(ingestStats.droppedPii),
      droppedRateLimited: sum(ingestStats.droppedRateLimited),
      droppedCardinality: sum(ingestStats.droppedCardinality),
    })
    .from(ingestStats)
    .where(and(eq(ingestStats.siteId, siteId), gte(ingestStats.minuteTs, cutoffTime)));

  if (results.length === 0) {
    return {
      acceptedCount: 0,
      droppedInvalid: 0,
      droppedPii: 0,
      droppedRateLimited: 0,
      droppedCardinality: 0,
    };
  }

  const r = results[0];
  return {
    acceptedCount: Number(r.acceptedCount || 0),
    droppedInvalid: Number(r.droppedInvalid || 0),
    droppedPii: Number(r.droppedPii || 0),
    droppedRateLimited: Number(r.droppedRateLimited || 0),
    droppedCardinality: Number(r.droppedCardinality || 0),
  };
}

/**
 * Get top pages by pageview count
 */
export async function getTopPages(
  siteId: string, 
  timeRange: TimeRange, 
  limit: number = 10,
  filters: FilterConfig[] = []
) {
  const pool = getPool();
  const params: any[] = [siteId, timeRange.start, timeRange.end];
  const { whereClause, params: filterParams } = applyFilters(filters, params.length + 1);
  params.push(...filterParams);
  
  const filterSql = whereClause ? ` AND ${whereClause}` : '';
  
  const result = await pool.query(`
    SELECT 
      path,
      COUNT(*)::INTEGER as pageviews,
      COUNT(DISTINCT vid)::INTEGER as unique_visitors,
      COUNT(DISTINCT sid)::INTEGER as unique_sessions
    FROM events_raw
    WHERE site_id = $1 
      AND ts >= $2 
      AND ts <= $3
      AND event_type = 'inc'
      AND event_name IS NULL
      ${filterSql}
    GROUP BY path
    ORDER BY pageviews DESC
    LIMIT $${params.length + 1}
  `, [...params, limit]);

  return result.rows.map((r: any) => ({
    path: r.path,
    pageviews: Number(r.pageviews),
    uniqueVisitors: Number(r.unique_visitors),
    uniqueSessions: Number(r.unique_sessions),
  }));
}

/**
 * Get device breakdown
 */
export async function getDeviceBreakdown(
  siteId: string, 
  timeRange: TimeRange,
  filters: FilterConfig[] = []
) {
  const pool = getPool();
  const params: any[] = [siteId, timeRange.start, timeRange.end];
  const { whereClause, params: filterParams } = applyFilters(filters, params.length + 1);
  params.push(...filterParams);
  
  const filterSql = whereClause ? ` AND ${whereClause}` : '';
  
  const result = await pool.query(`
    SELECT 
      COALESCE(device_category, 'unknown') as device_category,
      COUNT(*)::INTEGER as count,
      COUNT(DISTINCT vid)::INTEGER as unique_visitors
    FROM events_raw
    WHERE site_id = $1 
      AND ts >= $2 
      AND ts <= $3
      ${filterSql}
    GROUP BY device_category
    ORDER BY count DESC
  `, params);

  return result.rows.map((r: any) => ({
    deviceCategory: r.device_category,
    count: Number(r.count),
    uniqueVisitors: Number(r.unique_visitors),
  }));
}

/**
 * Get OS breakdown
 */
export async function getOSBreakdown(
  siteId: string, 
  timeRange: TimeRange,
  filters: FilterConfig[] = []
) {
  const pool = getPool();
  const params: any[] = [siteId, timeRange.start, timeRange.end];
  const { whereClause, params: filterParams } = applyFilters(filters, params.length + 1);
  params.push(...filterParams);
  
  const filterSql = whereClause ? ` AND ${whereClause}` : '';
  
  const result = await pool.query(`
    SELECT 
      COALESCE(os, 'unknown') as os,
      COUNT(*)::INTEGER as count,
      COUNT(DISTINCT vid)::INTEGER as unique_visitors
    FROM events_raw
    WHERE site_id = $1 
      AND ts >= $2 
      AND ts <= $3
      ${filterSql}
    GROUP BY os
    ORDER BY count DESC
    LIMIT 10
  `, params);

  return result.rows.map((r: any) => ({
    os: r.os,
    count: Number(r.count),
    uniqueVisitors: Number(r.unique_visitors),
  }));
}

/**
 * Get country breakdown
 */
export async function getCountryBreakdown(
  siteId: string, 
  timeRange: TimeRange, 
  limit: number = 10,
  filters: FilterConfig[] = []
) {
  const pool = getPool();
  const params: any[] = [siteId, timeRange.start, timeRange.end];
  const { whereClause, params: filterParams } = applyFilters(filters, params.length + 1);
  params.push(...filterParams);
  
  const filterSql = whereClause ? ` AND ${whereClause}` : '';
  
  const result = await pool.query(`
    SELECT 
      country,
      COUNT(*)::INTEGER as count,
      COUNT(DISTINCT vid)::INTEGER as unique_visitors
    FROM events_raw
    WHERE site_id = $1 
      AND ts >= $2 
      AND ts <= $3
      AND country IS NOT NULL
      ${filterSql}
    GROUP BY country
    ORDER BY count DESC
    LIMIT $${params.length + 1}
  `, [...params, limit]);

  return result.rows.map((r: any) => ({
    country: r.country,
    count: Number(r.count),
    uniqueVisitors: Number(r.unique_visitors),
  }));
}

/**
 * Get traffic sources (referrers and UTM)
 */
export async function getTrafficSources(
  siteId: string, 
  timeRange: TimeRange, 
  limit: number = 10,
  filters: FilterConfig[] = []
) {
  const pool = getPool();
  const params: any[] = [siteId, timeRange.start, timeRange.end];
  const { whereClause, params: filterParams } = applyFilters(filters, params.length + 1);
  params.push(...filterParams);
  
  const filterSql = whereClause ? ` AND ${whereClause}` : '';
  
  // Top referrers
  const referrersResult = await pool.query(`
    SELECT 
      COALESCE(ref_domain, 'direct') as source,
      COUNT(*)::INTEGER as count,
      COUNT(DISTINCT vid)::INTEGER as unique_visitors
    FROM events_raw
    WHERE site_id = $1 
      AND ts >= $2 
      AND ts <= $3
      ${filterSql}
    GROUP BY ref_domain
    ORDER BY count DESC
    LIMIT $${params.length + 1}
  `, [...params, limit]);

  // Top UTM campaigns
  const utmResult = await pool.query(`
    SELECT 
      utm_source,
      utm_medium,
      utm_campaign,
      COUNT(*)::INTEGER as count,
      COUNT(DISTINCT vid)::INTEGER as unique_visitors
    FROM events_raw
    WHERE site_id = $1 
      AND ts >= $2 
      AND ts <= $3
      AND (utm_source IS NOT NULL OR utm_medium IS NOT NULL OR utm_campaign IS NOT NULL)
      ${filterSql}
    GROUP BY utm_source, utm_medium, utm_campaign
    ORDER BY count DESC
    LIMIT $${params.length + 1}
  `, [...params, limit]);

  return {
    referrers: referrersResult.rows.map((r: any) => ({
      source: r.source,
      count: Number(r.count),
      uniqueVisitors: Number(r.unique_visitors),
    })),
    utmCampaigns: utmResult.rows.map((r: any) => ({
      source: r.utm_source || '',
      medium: r.utm_medium || '',
      campaign: r.utm_campaign || '',
      count: Number(r.count),
      uniqueVisitors: Number(r.unique_visitors),
    })),
  };
}

/**
 * Get unique visitors and sessions
 */
export async function getUniqueMetrics(
  siteId: string, 
  timeRange: TimeRange,
  filters: FilterConfig[] = []
) {
  const pool = getPool();
  const params: any[] = [siteId, timeRange.start, timeRange.end];
  const { whereClause, params: filterParams } = applyFilters(filters, params.length + 1);
  params.push(...filterParams);
  
  const filterSql = whereClause ? ` AND ${whereClause}` : '';
  
  const result = await pool.query(`
    SELECT 
      COUNT(DISTINCT vid)::INTEGER as unique_visitors,
      COUNT(DISTINCT sid)::INTEGER as unique_sessions,
      COUNT(*)::INTEGER as total_events
    FROM events_raw
    WHERE site_id = $1 
      AND ts >= $2 
      AND ts <= $3
      ${filterSql}
  `, params);

  if (result.rows.length === 0) {
    return {
      uniqueVisitors: 0,
      uniqueSessions: 0,
      totalEvents: 0,
    };
  }

  const r = result.rows[0];
  return {
    uniqueVisitors: Number(r.unique_visitors),
    uniqueSessions: Number(r.unique_sessions),
    totalEvents: Number(r.total_events),
  };
}

/**
 * Get bounce rate and session metrics
 */
export async function getSessionMetrics(
  siteId: string, 
  timeRange: TimeRange,
  filters: FilterConfig[] = []
) {
  const pool = getPool();
  const params: any[] = [siteId, timeRange.start, timeRange.end];
  const { whereClause, params: filterParams } = applyFilters(filters, params.length + 1);
  params.push(...filterParams);
  
  const filterSql = whereClause ? ` AND ${whereClause}` : '';
  
  // Get sessions with pageview counts
  const result = await pool.query(`
    WITH session_stats AS (
      SELECT 
        sid,
        COUNT(CASE WHEN event_type = 'inc' AND event_name IS NULL THEN 1 END)::INTEGER as pageviews,
        MIN(ts) as start_time,
        MAX(ts) as end_time
      FROM events_raw
      WHERE site_id = $1 
        AND ts >= $2 
        AND ts <= $3
        ${filterSql}
      GROUP BY sid
    )
    SELECT 
      COUNT(*)::INTEGER as total_sessions,
      COUNT(CASE WHEN pageviews = 1 THEN 1 END)::INTEGER as bounced_sessions,
      AVG(EXTRACT(EPOCH FROM (end_time - start_time)))::NUMERIC as avg_duration_seconds
    FROM session_stats
  `, params);

  if (result.rows.length === 0 || !result.rows[0].total_sessions) {
    return {
      totalSessions: 0,
      bouncedSessions: 0,
      bounceRate: 0,
      avgDurationSeconds: 0,
    };
  }

  const r = result.rows[0];
  const totalSessions = Number(r.total_sessions);
  const bouncedSessions = Number(r.bounced_sessions);
  const bounceRate = totalSessions > 0 ? (bouncedSessions / totalSessions) * 100 : 0;

  return {
    totalSessions,
    bouncedSessions,
    bounceRate: Math.round(bounceRate * 100) / 100,
    avgDurationSeconds: Number(r.avg_duration_seconds || 0),
  };
}

/**
 * Get page-specific metrics
 */
export async function getPageMetrics(siteId: string, path: string, timeRange: TimeRange) {
  const pool = getPool();
  
  // Get basic page metrics
  const basicResult = await pool.query(`
    SELECT 
      COUNT(*)::INTEGER as pageviews,
      COUNT(DISTINCT vid)::INTEGER as unique_visitors,
      COUNT(DISTINCT sid)::INTEGER as unique_sessions
    FROM events_raw
    WHERE site_id = $1 
      AND path = $2
      AND ts >= $3 
      AND ts <= $4
      AND event_type = 'inc'
      AND event_name IS NULL
  `, [siteId, path, timeRange.start, timeRange.end]);

  // Calculate average time on page by looking at time between consecutive pageviews in same session
  const timeResult = await pool.query(`
    WITH pageview_times AS (
      SELECT 
        sid,
        ts,
        LAG(ts) OVER (PARTITION BY sid ORDER BY ts) as prev_ts
      FROM events_raw
      WHERE site_id = $1 
        AND path = $2
        AND ts >= $3 
        AND ts <= $4
        AND event_type = 'inc'
        AND event_name IS NULL
    )
    SELECT 
      AVG(EXTRACT(EPOCH FROM (ts - prev_ts)))::NUMERIC as avg_time_on_page
    FROM pageview_times
    WHERE prev_ts IS NOT NULL
  `, [siteId, path, timeRange.start, timeRange.end]);

  if (basicResult.rows.length === 0) {
    return {
      pageviews: 0,
      uniqueVisitors: 0,
      uniqueSessions: 0,
      avgTimeOnPage: 0,
    };
  }

  const r = basicResult.rows[0];
  const avgTime = timeResult.rows.length > 0 && timeResult.rows[0].avg_time_on_page
    ? Number(timeResult.rows[0].avg_time_on_page)
    : 0;

  return {
    pageviews: Number(r.pageviews),
    uniqueVisitors: Number(r.unique_visitors),
    uniqueSessions: Number(r.unique_sessions),
    avgTimeOnPage: avgTime,
  };
}

/**
 * Get realtime active users (last N minutes)
 */
export async function getRealtimeUsers(siteId: string, minutes: number = 30) {
  const pool = getPool();
  const cutoffTime = new Date();
  cutoffTime.setMinutes(cutoffTime.getMinutes() - minutes);

  const result = await pool.query(`
    SELECT COUNT(DISTINCT vid)::INTEGER as active_users
    FROM events_raw
    WHERE site_id = $1 AND ts >= $2
  `, [siteId, cutoffTime]);

  return result.rows[0]?.active_users || 0;
}

/**
 * Get realtime top pages (last N minutes)
 */
export async function getRealtimePages(siteId: string, minutes: number = 30, limit: number = 10) {
  const pool = getPool();
  const cutoffTime = new Date();
  cutoffTime.setMinutes(cutoffTime.getMinutes() - minutes);

  const result = await pool.query(`
    SELECT 
      path,
      COUNT(*)::INTEGER as pageviews,
      COUNT(DISTINCT vid)::INTEGER as active_users
    FROM events_raw
    WHERE site_id = $1 
      AND ts >= $2
      AND event_type = 'inc'
      AND event_name IS NULL
    GROUP BY path
    ORDER BY pageviews DESC
    LIMIT $3
  `, [siteId, cutoffTime, limit]);

  return result.rows.map((r: any) => ({
    path: r.path,
    pageviews: Number(r.pageviews),
    activeUsers: Number(r.active_users),
  }));
}

/**
 * Get realtime top events (last N minutes)
 */
export async function getRealtimeEvents(siteId: string, minutes: number = 30, limit: number = 10) {
  const pool = getPool();
  const cutoffTime = new Date();
  cutoffTime.setMinutes(cutoffTime.getMinutes() - minutes);

  const result = await pool.query(`
    SELECT 
      COALESCE(event_name, 'pageview') as event_name,
      COUNT(*)::INTEGER as count,
      COUNT(DISTINCT vid)::INTEGER as active_users
    FROM events_raw
    WHERE site_id = $1 
      AND ts >= $2
      AND event_name IS NOT NULL
    GROUP BY event_name
    ORDER BY count DESC
    LIMIT $3
  `, [siteId, cutoffTime, limit]);

  return result.rows.map((r: any) => ({
    eventName: r.event_name,
    count: Number(r.count),
    activeUsers: Number(r.active_users),
  }));
}

/**
 * Get realtime top referrers (last N minutes)
 */
export async function getRealtimeReferrers(siteId: string, minutes: number = 30, limit: number = 10) {
  const pool = getPool();
  const cutoffTime = new Date();
  cutoffTime.setMinutes(cutoffTime.getMinutes() - minutes);

  const result = await pool.query(`
    SELECT 
      COALESCE(ref_domain, 'direct') as referrer,
      COUNT(*)::INTEGER as count,
      COUNT(DISTINCT vid)::INTEGER as active_users
    FROM events_raw
    WHERE site_id = $1 
      AND ts >= $2
    GROUP BY ref_domain
    ORDER BY count DESC
    LIMIT $3
  `, [siteId, cutoffTime, limit]);

  return result.rows.map((r: any) => ({
    referrer: r.referrer,
    count: Number(r.count),
    activeUsers: Number(r.active_users),
  }));
}

/**
 * Get realtime geographic data (last N minutes)
 */
export async function getRealtimeGeo(siteId: string, minutes: number = 30, limit: number = 10) {
  const pool = getPool();
  const cutoffTime = new Date();
  cutoffTime.setMinutes(cutoffTime.getMinutes() - minutes);

  const result = await pool.query(`
    SELECT 
      country,
      COUNT(*)::INTEGER as count,
      COUNT(DISTINCT vid)::INTEGER as active_users
    FROM events_raw
    WHERE site_id = $1 
      AND ts >= $2
      AND country IS NOT NULL
    GROUP BY country
    ORDER BY count DESC
    LIMIT $3
  `, [siteId, cutoffTime, limit]);

  return result.rows.map((r: any) => ({
    country: r.country,
    count: Number(r.count),
    activeUsers: Number(r.active_users),
  }));
}

/**
 * Get realtime device breakdown (last N minutes)
 */
export async function getRealtimeDevices(siteId: string, minutes: number = 30) {
  const pool = getPool();
  const cutoffTime = new Date();
  cutoffTime.setMinutes(cutoffTime.getMinutes() - minutes);

  const result = await pool.query(`
    SELECT 
      COALESCE(device_category, 'unknown') as device_category,
      COUNT(*)::INTEGER as count,
      COUNT(DISTINCT vid)::INTEGER as active_users
    FROM events_raw
    WHERE site_id = $1 
      AND ts >= $2
    GROUP BY device_category
    ORDER BY count DESC
  `, [siteId, cutoffTime]);

  return result.rows.map((r: any) => ({
    deviceCategory: r.device_category,
    count: Number(r.count),
    activeUsers: Number(r.active_users),
  }));
}

/**
 * Get live activity feed (recent events)
 */
export async function getLiveActivityFeed(siteId: string, minutes: number = 5, limit: number = 50) {
  const pool = getPool();
  const cutoffTime = new Date();
  cutoffTime.setMinutes(cutoffTime.getMinutes() - minutes);

  const result = await pool.query(`
    SELECT 
      ts,
      path,
      COALESCE(event_name, 'pageview') as event_name,
      event_type,
      country,
      device_category,
      ref_domain
    FROM events_raw
    WHERE site_id = $1 
      AND ts >= $2
    ORDER BY ts DESC
    LIMIT $3
  `, [siteId, cutoffTime, limit]);

  return result.rows.map((r: any) => ({
    timestamp: r.ts,
    path: r.path,
    eventName: r.event_name,
    eventType: r.event_type,
    country: r.country,
    deviceCategory: r.device_category,
    referrer: r.ref_domain,
  }));
}

/**
 * Get active sessions with user journey
 */
export async function getActiveSessions(siteId: string, minutes: number = 5, limit: number = 20) {
  const pool = getPool();
  const cutoffTime = new Date();
  cutoffTime.setMinutes(cutoffTime.getMinutes() - minutes);

  const result = await pool.query(`
    WITH active_sessions AS (
      SELECT DISTINCT sid
      FROM events_raw
      WHERE site_id = $1 
        AND ts >= $2
    ),
    session_journeys AS (
      SELECT 
        e.sid,
        MIN(e.ts) as start_time,
        MAX(e.ts) as last_activity,
        COUNT(*)::INTEGER as event_count,
        array_agg(e.path ORDER BY e.ts) FILTER (WHERE e.event_type = 'inc' AND e.event_name IS NULL) as pages,
        MAX(e.country) as country,
        MAX(e.device_category) as device_category,
        MAX(e.ref_domain) as referrer
      FROM events_raw e
      INNER JOIN active_sessions a ON e.sid = a.sid
      WHERE e.site_id = $1
      GROUP BY e.sid
    )
    SELECT 
      sid,
      start_time,
      last_activity,
      event_count,
      pages,
      country,
      device_category,
      referrer
    FROM session_journeys
    ORDER BY last_activity DESC
    LIMIT $3
  `, [siteId, cutoffTime, limit]);

  return result.rows.map((r: any) => {
    // Deduplicate pages array while preserving order
    const pages = r.pages || [];
    const uniquePages: string[] = [];
    const seen = new Set<string>();
    for (const page of pages) {
      if (!seen.has(page)) {
        seen.add(page);
        uniquePages.push(page);
      }
    }
    
    return {
      sessionId: r.sid,
      startTime: r.start_time,
      lastActivity: r.last_activity,
      eventCount: Number(r.event_count),
      pages: uniquePages,
      country: r.country,
      deviceCategory: r.device_category,
      referrer: r.referrer,
    };
  });
}

/**
 * Get realtime error rate
 */
export async function getRealtimeErrorRate(siteId: string, minutes: number = 30) {
  const pool = getPool();
  const cutoffTime = new Date();
  cutoffTime.setMinutes(cutoffTime.getMinutes() - minutes);

  const result = await pool.query(`
    SELECT 
      COUNT(CASE WHEN error_type IS NOT NULL THEN 1 END)::INTEGER as error_count,
      COUNT(*)::INTEGER as total_events
    FROM events_raw
    WHERE site_id = $1 
      AND ts >= $2
  `, [siteId, cutoffTime]);

  const errorCount = result.rows[0]?.error_count || 0;
  const totalEvents = result.rows[0]?.total_events || 0;
  const errorRate = totalEvents > 0 ? (errorCount / totalEvents) * 100 : 0;

  return {
    errorCount,
    totalEvents,
    errorRate: Math.round(errorRate * 100) / 100,
  };
}

/**
 * Get realtime conversion events
 */
export async function getRealtimeConversions(siteId: string, minutes: number = 30, limit: number = 20) {
  const pool = getPool();
  const cutoffTime = new Date();
  cutoffTime.setMinutes(cutoffTime.getMinutes() - minutes);

  const result = await pool.query(`
    SELECT 
      ts,
      path,
      event_name,
      value,
      currency,
      country,
      device_category
    FROM events_raw
    WHERE site_id = $1 
      AND ts >= $2
      AND event_type = 'event'
      AND event_name IN ('purchase', 'signup', 'conversion')
    ORDER BY ts DESC
    LIMIT $3
  `, [siteId, cutoffTime, limit]);

  return result.rows.map((r: any) => ({
    timestamp: r.ts,
    path: r.path,
    eventName: r.event_name,
    value: r.value ? Number(r.value) : null,
    currency: r.currency,
    country: r.country,
    deviceCategory: r.device_category,
  }));
}

/**
 * Get realtime UTM campaign performance
 */
export async function getRealtimeUTMCampaigns(siteId: string, minutes: number = 30, limit: number = 10) {
  const pool = getPool();
  const cutoffTime = new Date();
  cutoffTime.setMinutes(cutoffTime.getMinutes() - minutes);

  const result = await pool.query(`
    SELECT 
      utm_campaign,
      utm_source,
      utm_medium,
      COUNT(*)::INTEGER as count,
      COUNT(DISTINCT vid)::INTEGER as active_users
    FROM events_raw
    WHERE site_id = $1 
      AND ts >= $2
      AND utm_campaign IS NOT NULL
    GROUP BY utm_campaign, utm_source, utm_medium
    ORDER BY count DESC
    LIMIT $3
  `, [siteId, cutoffTime, limit]);

  return result.rows.map((r: any) => ({
    campaign: r.utm_campaign,
    source: r.utm_source,
    medium: r.utm_medium,
    count: Number(r.count),
    activeUsers: Number(r.active_users),
  }));
}

/**
 * Get new vs returning visitors
 */
export async function getNewVsReturning(siteId: string, timeRange: TimeRange) {
  const pool = getPool();
  
  // Get first visit timestamp for each visitor (across all time)
  // Then check if their first visit was within the time range (new) or before (returning)
  const result = await pool.query(`
    WITH visitor_first_visit AS (
      SELECT 
        vid,
        MIN(ts) as first_visit_ts
      FROM events_raw
      WHERE site_id = $1
      GROUP BY vid
    ),
    visitors_in_range AS (
      SELECT DISTINCT er.vid
      FROM events_raw er
      WHERE er.site_id = $1
        AND er.ts >= $2
        AND er.ts <= $3
    ),
    visitor_types AS (
      SELECT 
        vir.vid,
        CASE 
          WHEN vfv.first_visit_ts >= $2 THEN 'new'
          ELSE 'returning'
        END as visitor_type
      FROM visitors_in_range vir
      JOIN visitor_first_visit vfv ON vir.vid = vfv.vid
    )
    SELECT 
      visitor_type,
      COUNT(DISTINCT vid)::INTEGER as visitors
    FROM visitor_types
    GROUP BY visitor_type
  `, [siteId, timeRange.start, timeRange.end]);

  const newVisitors = result.rows.find((r: any) => r.visitor_type === 'new')?.visitors || 0;
  const returningVisitors = result.rows.find((r: any) => r.visitor_type === 'returning')?.visitors || 0;
  const total = newVisitors + returningVisitors;

  return {
    new: newVisitors,
    returning: returningVisitors,
    total,
    newPercentage: total > 0 ? (newVisitors / total) * 100 : 0,
    returningPercentage: total > 0 ? (returningVisitors / total) * 100 : 0,
  };
}

/**
 * Get engagement metrics
 */
/**
 * Get cohort analysis data (acquisition date cohorts)
 */
export async function getCohortAnalysis(
  siteId: string,
  cohortType: 'acquisition' | 'event' = 'acquisition',
  eventName?: string,
  timeRange?: TimeRange
) {
  const pool = getPool();
  
  if (cohortType === 'acquisition') {
    // Acquisition date cohorts
    const result = await pool.query(`
      WITH visitor_first_visit AS (
        SELECT 
          vid,
          DATE(MIN(ts)) as cohort_date
        FROM events_raw
        WHERE site_id = $1
        GROUP BY vid
      ),
      cohort_sessions AS (
        SELECT 
          vfv.cohort_date,
          DATE(er.ts) as session_date,
          COUNT(DISTINCT er.sid)::INTEGER as sessions,
          COUNT(DISTINCT er.vid)::INTEGER as visitors
        FROM events_raw er
        JOIN visitor_first_visit vfv ON er.vid = vfv.vid
        WHERE er.site_id = $1
          ${timeRange ? 'AND er.ts >= $2 AND er.ts <= $3' : ''}
        GROUP BY vfv.cohort_date, DATE(er.ts)
      )
      SELECT 
        cohort_date,
        session_date,
        sessions,
        visitors,
        (session_date - cohort_date)::INTEGER as days_since_acquisition
      FROM cohort_sessions
      ORDER BY cohort_date DESC, days_since_acquisition ASC
    `, timeRange ? [siteId, timeRange.start, timeRange.end] : [siteId]);

    // Group by cohort
    const cohorts: Record<string, Array<{ daysSinceAcquisition: number; sessions: number; visitors: number }>> = {};
    
    result.rows.forEach((r: any) => {
      const cohortDate = r.cohort_date.toISOString().split('T')[0];
      if (!cohorts[cohortDate]) {
        cohorts[cohortDate] = [];
      }
      cohorts[cohortDate].push({
        daysSinceAcquisition: Number(r.days_since_acquisition),
        sessions: Number(r.sessions),
        visitors: Number(r.visitors),
      });
    });

    return {
      type: 'acquisition',
      cohorts: Object.entries(cohorts).map(([date, data]) => ({
        cohortDate: date,
        data,
      })),
    };
  } else {
    // Event-based cohorts (e.g., first purchase date)
    if (!eventName) {
      throw new Error('Event name required for event-based cohorts');
    }

    const result = await pool.query(`
      WITH visitor_first_event AS (
        SELECT 
          vid,
          DATE(MIN(ts)) as cohort_date
        FROM events_raw
        WHERE site_id = $1
          AND event_type = 'event'
          AND event_name = $2
        GROUP BY vid
      ),
      cohort_sessions AS (
        SELECT 
          vfe.cohort_date,
          DATE(er.ts) as session_date,
          COUNT(DISTINCT er.sid)::INTEGER as sessions,
          COUNT(DISTINCT er.vid)::INTEGER as visitors
        FROM events_raw er
        JOIN visitor_first_event vfe ON er.vid = vfe.vid
        WHERE er.site_id = $1
          ${timeRange ? 'AND er.ts >= $3 AND er.ts <= $4' : ''}
        GROUP BY vfe.cohort_date, DATE(er.ts)
      )
      SELECT 
        cohort_date,
        session_date,
        sessions,
        visitors,
        (session_date - cohort_date)::INTEGER as days_since_event
      FROM cohort_sessions
      ORDER BY cohort_date DESC, days_since_event ASC
    `, timeRange ? [siteId, eventName, timeRange.start, timeRange.end] : [siteId, eventName]);

    const cohorts: Record<string, Array<{ daysSinceEvent: number; sessions: number; visitors: number }>> = {};
    
    result.rows.forEach((r: any) => {
      const cohortDate = r.cohort_date.toISOString().split('T')[0];
      if (!cohorts[cohortDate]) {
        cohorts[cohortDate] = [];
      }
      cohorts[cohortDate].push({
        daysSinceEvent: Number(r.days_since_event),
        sessions: Number(r.sessions),
        visitors: Number(r.visitors),
      });
    });

    return {
      type: 'event',
      eventName,
      cohorts: Object.entries(cohorts).map(([date, data]) => ({
        cohortDate: date,
        data,
      })),
    };
  }
}

/**
 * Get retention analysis (D1, D7, D30 retention)
 */
export async function getRetentionAnalysis(
  siteId: string,
  timeRange: TimeRange,
  retentionDays: number[] = [1, 7, 30]
) {
  const pool = getPool();
  
  const result = await pool.query(`
    WITH visitor_first_visit AS (
      SELECT 
        vid,
        DATE(MIN(ts)) as first_visit_date
      FROM events_raw
      WHERE site_id = $1
      GROUP BY vid
    ),
    visitor_visits AS (
      SELECT 
        vfv.vid,
        vfv.first_visit_date,
        DATE(er.ts) as visit_date
      FROM events_raw er
      JOIN visitor_first_visit vfv ON er.vid = vfv.vid
      WHERE er.site_id = $1
        AND er.ts >= $2
        AND er.ts <= $3
      GROUP BY vfv.vid, vfv.first_visit_date, DATE(er.ts)
    )
    SELECT 
      first_visit_date as cohort_date,
      ${retentionDays.map((d, i) => `
        COUNT(DISTINCT CASE 
          WHEN visit_date = first_visit_date + INTERVAL '${d} days' THEN vid 
        END)::INTEGER as d${d}_retained
      `).join(',')},
      COUNT(DISTINCT CASE WHEN visit_date = first_visit_date THEN vid END)::INTEGER as d0_total
    FROM visitor_visits
    WHERE first_visit_date >= $2::DATE - INTERVAL '90 days'
    GROUP BY first_visit_date
    ORDER BY first_visit_date DESC
    LIMIT 90
  `, [siteId, timeRange.start, timeRange.end]);

  return result.rows.map((r: any) => {
    const d0Total = Number(r.d0_total || 0);
    const retention: Record<number, number> = {};
    
    retentionDays.forEach((d) => {
      const retained = Number(r[`d${d}_retained`] || 0);
      retention[d] = d0Total > 0 ? (retained / d0Total) * 100 : 0;
    });

    return {
      cohortDate: r.cohort_date.toISOString().split('T')[0],
      d0Total,
      retention,
    };
  });
}

export async function getEngagementMetrics(
  siteId: string, 
  timeRange: TimeRange,
  filters: FilterConfig[] = []
) {
  const pool = getPool();
  const params: any[] = [siteId, timeRange.start, timeRange.end];
  const { whereClause, params: filterParams } = applyFilters(filters, params.length + 1);
  params.push(...filterParams);
  
  const filterSql = whereClause ? ` AND ${whereClause}` : '';
  
  const result = await pool.query(`
    WITH session_stats AS (
      SELECT 
        sid,
        COUNT(CASE WHEN event_type = 'inc' AND event_name IS NULL THEN 1 END)::INTEGER as pageviews,
        MIN(ts) as start_time,
        MAX(ts) as end_time
      FROM events_raw
      WHERE site_id = $1 
        AND ts >= $2 
        AND ts <= $3
        ${filterSql}
      GROUP BY sid
    )
    SELECT 
      AVG(pageviews)::NUMERIC as avg_pages_per_session,
      AVG(EXTRACT(EPOCH FROM (end_time - start_time)))::NUMERIC as avg_session_duration,
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY pageviews)::NUMERIC as median_pages_per_session
    FROM session_stats
  `, params);

  if (result.rows.length === 0) {
    return {
      avgPagesPerSession: 0,
      avgSessionDuration: 0,
      medianPagesPerSession: 0,
    };
  }

  const r = result.rows[0];
  return {
    avgPagesPerSession: Number(r.avg_pages_per_session || 0),
    avgSessionDuration: Number(r.avg_session_duration || 0),
    medianPagesPerSession: Number(r.median_pages_per_session || 0),
  };
}

/**
 * Get channel grouping (Organic, Direct, Referral, Social, Paid)
 */
export async function getChannelGrouping(
  siteId: string, 
  timeRange: TimeRange,
  filters: FilterConfig[] = []
) {
  const pool = getPool();
  const params: any[] = [siteId, timeRange.start, timeRange.end];
  const { whereClause, params: filterParams } = applyFilters(filters, params.length + 1);
  params.push(...filterParams);
  
  const filterSql = whereClause ? ` AND ${whereClause}` : '';
  
  const result = await pool.query(`
    SELECT 
      CASE
        WHEN ref_domain IS NULL AND (utm_source IS NULL OR utm_source = '') THEN 'Direct'
        WHEN utm_medium = 'organic' OR (utm_source = 'google' AND utm_medium IS NULL) THEN 'Organic'
        WHEN utm_medium IN ('cpc', 'paid', 'ppc') THEN 'Paid'
        WHEN utm_medium IN ('social', 'social-media') OR utm_source IN ('facebook', 'twitter', 'linkedin', 'instagram') THEN 'Social'
        WHEN ref_domain IS NOT NULL THEN 'Referral'
        ELSE 'Other'
      END as channel,
      COUNT(*)::INTEGER as sessions,
      COUNT(DISTINCT vid)::INTEGER as visitors
    FROM events_raw
    WHERE site_id = $1 
      AND ts >= $2 
      AND ts <= $3
      ${filterSql}
    GROUP BY channel
    ORDER BY sessions DESC
  `, params);

  return result.rows.map((r: any) => ({
    channel: r.channel,
    sessions: Number(r.sessions),
    visitors: Number(r.visitors),
  }));
}

/**
 * Get UTM terms (keywords)
 */
export async function getUTMTerms(
  siteId: string, 
  timeRange: TimeRange, 
  limit: number = 20,
  filters: FilterConfig[] = []
) {
  const pool = getPool();
  const params: any[] = [siteId, timeRange.start, timeRange.end];
  const { whereClause, params: filterParams } = applyFilters(filters, params.length + 1);
  params.push(...filterParams);
  
  const filterSql = whereClause ? ` AND ${whereClause}` : '';
  
  const result = await pool.query(`
    SELECT 
      utm_term as keyword,
      COUNT(*)::INTEGER as sessions,
      COUNT(DISTINCT vid)::INTEGER as visitors
    FROM events_raw
    WHERE site_id = $1 
      AND ts >= $2 
      AND ts <= $3
      AND utm_term IS NOT NULL
      AND utm_term != ''
      ${filterSql}
    GROUP BY utm_term
    ORDER BY sessions DESC
    LIMIT $${params.length + 1}
  `, [...params, limit]);

  return result.rows.map((r: any) => ({
    keyword: r.keyword,
    sessions: Number(r.sessions),
    visitors: Number(r.visitors),
  }));
}

/**
 * Get landing pages (entry pages)
 */
export async function getLandingPages(
  siteId: string, 
  timeRange: TimeRange, 
  limit: number = 20,
  filters: FilterConfig[] = []
) {
  const pool = getPool();
  const params: any[] = [siteId, timeRange.start, timeRange.end];
  const { whereClause, params: filterParams } = applyFilters(filters, params.length + 1);
  params.push(...filterParams);
  
  const filterSql = whereClause ? ` AND ${whereClause}` : '';
  
  const result = await pool.query(`
    WITH session_first_page AS (
      SELECT DISTINCT ON (sid)
        sid,
        path as landing_page,
        ts
      FROM events_raw
      WHERE site_id = $1 
        AND ts >= $2 
        AND ts <= $3
        AND event_type = 'inc'
        AND event_name IS NULL
        ${filterSql}
      ORDER BY sid, ts ASC
    )
    SELECT 
      landing_page,
      COUNT(*)::INTEGER as sessions,
      COUNT(DISTINCT er.vid)::INTEGER as visitors
    FROM session_first_page sfp
    JOIN events_raw er ON er.sid = sfp.sid
    WHERE er.site_id = $1
      AND er.ts >= $2 
      AND er.ts <= $3
    GROUP BY landing_page
    ORDER BY sessions DESC
    LIMIT $${params.length + 1}
  `, [...params, limit]);

  return result.rows.map((r: any) => ({
    path: r.landing_page,
    sessions: Number(r.sessions),
    visitors: Number(r.visitors),
  }));
}

/**
 * Get exit pages
 */
export async function getExitPages(
  siteId: string, 
  timeRange: TimeRange, 
  limit: number = 20,
  filters: FilterConfig[] = []
) {
  const pool = getPool();
  const params: any[] = [siteId, timeRange.start, timeRange.end];
  const { whereClause, params: filterParams } = applyFilters(filters, params.length + 1);
  params.push(...filterParams);
  
  const filterSql = whereClause ? ` AND ${whereClause}` : '';
  
  const result = await pool.query(`
    WITH session_last_page AS (
      SELECT DISTINCT ON (sid)
        sid,
        path as exit_page,
        ts
      FROM events_raw
      WHERE site_id = $1 
        AND ts >= $2 
        AND ts <= $3
        AND event_type = 'inc'
        AND event_name IS NULL
        ${filterSql}
      ORDER BY sid, ts DESC
    )
    SELECT 
      exit_page,
      COUNT(*)::INTEGER as exits,
      COUNT(DISTINCT er.vid)::INTEGER as visitors
    FROM session_last_page slp
    JOIN events_raw er ON er.sid = slp.sid
    WHERE er.site_id = $1
      AND er.ts >= $2 
      AND er.ts <= $3
    GROUP BY exit_page
    ORDER BY exits DESC
    LIMIT $${params.length + 1}
  `, [...params, limit]);

  return result.rows.map((r: any) => ({
    path: r.exit_page,
    exits: Number(r.exits),
    visitors: Number(r.visitors),
  }));
}

/**
 * Get user flow (page paths)
 */
export async function getUserFlow(siteId: string, timeRange: TimeRange, maxSteps: number = 5) {
  const pool = getPool();
  
  // Get page sequences per session
  const result = await pool.query(`
    WITH session_pages AS (
      SELECT 
        sid,
        array_agg(path ORDER BY ts) FILTER (WHERE event_type = 'inc' AND event_name IS NULL) as pages
      FROM events_raw
      WHERE site_id = $1 
        AND ts >= $2 
        AND ts <= $3
        AND event_type = 'inc'
        AND event_name IS NULL
      GROUP BY sid
    )
    SELECT 
      pages[1] as entry_page,
      pages[2] as second_page,
      pages[3] as third_page,
      COUNT(*)::INTEGER as sessions
    FROM session_pages
    WHERE array_length(pages, 1) >= 2
    GROUP BY pages[1], pages[2], pages[3]
    ORDER BY sessions DESC
    LIMIT 100
  `, [siteId, timeRange.start, timeRange.end]);

  // Group by entry page and build flow
  const flowMap: Record<string, { next: Record<string, number> }> = {};
  
  result.rows.forEach((r: any) => {
    const entry = r.entry_page || '(entrance)';
    const second = r.second_page || '(exit)';
    
    if (!flowMap[entry]) {
      flowMap[entry] = { next: {} };
    }
    flowMap[entry].next[second] = (flowMap[entry].next[second] || 0) + Number(r.sessions);
  });

  return Object.entries(flowMap).map(([entry, data]) => ({
    entry,
    flows: Object.entries(data.next)
      .map(([next, count]) => ({ next, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, maxSteps),
  }));
}

/**
 * Query Explorer: Get available dimensions (including custom dimensions)
 */
export async function getAvailableDimensions(siteId?: string) {
  const baseDimensions = [
    { key: 'path', label: 'Page Path', type: 'string' },
    { key: 'country', label: 'Country', type: 'string' },
    { key: 'device_category', label: 'Device Category', type: 'string' },
    { key: 'os', label: 'Operating System', type: 'string' },
    { key: 'ref_domain', label: 'Referrer Domain', type: 'string' },
    { key: 'utm_source', label: 'UTM Source', type: 'string' },
    { key: 'utm_medium', label: 'UTM Medium', type: 'string' },
    { key: 'utm_campaign', label: 'UTM Campaign', type: 'string' },
    { key: 'utm_content', label: 'UTM Content', type: 'string' },
    { key: 'utm_term', label: 'UTM Term', type: 'string' },
    { key: 'event_name', label: 'Event Name', type: 'string' },
    { key: 'event_type', label: 'Event Type', type: 'string' },
    { key: 'browser_name', label: 'Browser Name', type: 'string' },
    { key: 'browser_version', label: 'Browser Version', type: 'string' },
    { key: 'language', label: 'Language', type: 'string' },
  ];

  if (!siteId) {
    return baseDimensions;
  }

  // Fetch custom dimensions
  const db = getDb();
  const customDims = await db
    .select()
    .from(customDimensions)
    .where(and(eq(customDimensions.siteId, siteId), eq(customDimensions.enabled, true)));

  const customDimensionsList = customDims.map((dim) => ({
    key: `custom_dimension:${dim.name}`,
    label: dim.name,
    type: dim.dataType,
    scope: dim.scope,
  }));

  return [...baseDimensions, ...customDimensionsList];
}

/**
 * Query Explorer: Get available metrics (including calculated metrics)
 */
export async function getAvailableMetrics(siteId?: string) {
  const baseMetrics = [
    { key: 'pageviews', label: 'Pageviews', type: 'count', aggregation: 'sum' },
    { key: 'sessions', label: 'Sessions', type: 'count', aggregation: 'count_distinct_sid' },
    { key: 'unique_visitors', label: 'Unique Visitors', type: 'count', aggregation: 'count_distinct_vid' },
    { key: 'events', label: 'Events', type: 'count', aggregation: 'sum' },
    { key: 'revenue', label: 'Revenue', type: 'currency', aggregation: 'sum' },
    { key: 'bounce_rate', label: 'Bounce Rate', type: 'percentage', aggregation: 'avg' },
    { key: 'avg_session_duration', label: 'Avg Session Duration', type: 'duration', aggregation: 'avg' },
  ];

  if (!siteId) {
    return baseMetrics;
  }

  // Fetch calculated metrics
  const db = getDb();
  const calculated = await db
    .select()
    .from(calculatedMetrics)
    .where(and(eq(calculatedMetrics.siteId, siteId), eq(calculatedMetrics.enabled, true)));

  const calculatedMetricsList = calculated.map((metric) => ({
    key: `calculated:${metric.name}`,
    label: metric.name,
    type: 'calculated',
    formula: metric.formula,
  }));

  return [...baseMetrics, ...calculatedMetricsList];
}

/**
 * Query Explorer: Validate query configuration
 */
export function validateQuery(queryConfig: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!queryConfig.timeRange || !queryConfig.timeRange.start || !queryConfig.timeRange.end) {
    errors.push('Time range is required');
  }

  if (!queryConfig.dimensions || queryConfig.dimensions.length === 0) {
    errors.push('At least one dimension is required');
  }

  if (!queryConfig.metrics || queryConfig.metrics.length === 0) {
    errors.push('At least one metric is required');
  }

  if (queryConfig.dimensions && queryConfig.dimensions.length > 5) {
    errors.push('Maximum 5 dimensions allowed');
  }

  if (queryConfig.metrics && queryConfig.metrics.length > 10) {
    errors.push('Maximum 10 metrics allowed');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Query Explorer: Build and execute flexible query
 */
export async function exploreQuery(siteId: string, queryConfig: any) {
  const pool = getPool();
  const validation = validateQuery(queryConfig);
  
  if (!validation.valid) {
    throw new Error(`Invalid query: ${validation.errors.join(', ')}`);
  }

  const { timeRange, dimensions, metrics, filters = [], orderBy, limit = 100, timeGrouping } = queryConfig;

  // Build SELECT clause
  const selectParts: string[] = [];
  dimensions.forEach((dim: string) => {
    selectParts.push(`${dim} as ${dim}`);
  });
  
  metrics.forEach((metric: string) => {
    switch (metric) {
      case 'pageviews':
        selectParts.push(`COUNT(CASE WHEN event_type = 'inc' AND event_name IS NULL THEN 1 END)::INTEGER as pageviews`);
        break;
      case 'sessions':
        selectParts.push(`COUNT(DISTINCT sid)::INTEGER as sessions`);
        break;
      case 'unique_visitors':
        selectParts.push(`COUNT(DISTINCT vid)::INTEGER as unique_visitors`);
        break;
      case 'events':
        selectParts.push(`COUNT(*)::INTEGER as events`);
        break;
      case 'revenue':
        selectParts.push(`SUM(COALESCE(value, 0))::NUMERIC as revenue`);
        break;
      default:
        selectParts.push(`COUNT(*)::INTEGER as ${metric}`);
    }
  });

  // Build WHERE clause
  const whereParts: string[] = [`site_id = $1`, `ts >= $2`, `ts <= $3`];
  const params: any[] = [siteId, timeRange.start, timeRange.end];
  let paramIndex = 4;

  filters.forEach((filter: any) => {
    if (filter.dimension) {
      const op = filter.operator === 'equals' ? '=' : 
                  filter.operator === 'contains' ? 'ILIKE' :
                  filter.operator === 'gt' ? '>' :
                  filter.operator === 'lt' ? '<' : '=';
      if (filter.operator === 'contains') {
        whereParts.push(`${filter.dimension} ${op} $${paramIndex}`);
        params.push(`%${filter.value}%`);
      } else {
        whereParts.push(`${filter.dimension} ${op} $${paramIndex}`);
        params.push(filter.value);
      }
      paramIndex++;
    }
  });

  // Build GROUP BY clause
  const groupByParts = dimensions.map((d: string) => d);
  if (timeGrouping) {
    const timeExpr = timeGrouping === 'hour' ? "DATE_TRUNC('hour', ts)" :
                     timeGrouping === 'day' ? "DATE_TRUNC('day', ts)" :
                     timeGrouping === 'week' ? "DATE_TRUNC('week', ts)" :
                     "DATE_TRUNC('month', ts)";
    selectParts.unshift(`${timeExpr} as time_bucket`);
    groupByParts.unshift('time_bucket');
  }

  // Build ORDER BY clause
  let orderByClause = '';
  if (orderBy && orderBy.metric) {
    orderByClause = `ORDER BY ${orderBy.metric} ${orderBy.direction || 'DESC'}`;
  } else if (metrics.length > 0) {
    orderByClause = `ORDER BY ${metrics[0]} DESC`;
  }

  // Build final SQL
  const sql = `
    SELECT ${selectParts.join(', ')}
    FROM events_raw
    WHERE ${whereParts.join(' AND ')}
    ${groupByParts.length > 0 ? `GROUP BY ${groupByParts.join(', ')}` : ''}
    ${orderByClause}
    ${limit ? `LIMIT ${limit}` : ''}
  `;

  const result = await pool.query(sql, params);
  return result.rows;
}

/**
 * Get A/B test analysis with statistical significance
 */
export async function getExperimentAnalysis(
  siteId: string,
  experimentName: string,
  timeRange: TimeRange,
  conversionEvent?: string
) {
  const pool = getPool();
  
  // Get variant performance
  const result = await pool.query(`
    WITH variant_events AS (
      SELECT 
        er.vid,
        er.sid,
        er.ts,
        er.event_name,
        (er.custom_dimensions->>$1)::text as variant,
        CASE WHEN er.event_type = 'event' AND ($2 IS NULL OR er.event_name = $2) THEN 1 ELSE 0 END as is_conversion
      FROM events_raw er
      WHERE er.site_id = $3
        AND er.ts >= $4
        AND er.ts <= $5
        AND er.custom_dimensions->>$1 IS NOT NULL
    ),
    variant_stats AS (
      SELECT 
        variant,
        COUNT(DISTINCT vid)::INTEGER as visitors,
        COUNT(DISTINCT sid)::INTEGER as sessions,
        SUM(is_conversion)::INTEGER as conversions
      FROM variant_events
      GROUP BY variant
    )
    SELECT 
      variant,
      visitors,
      sessions,
      conversions,
      CASE WHEN sessions > 0 THEN (conversions::NUMERIC / sessions) * 100 ELSE 0 END as conversion_rate
    FROM variant_stats
    ORDER BY variant
  `, [`experiment:${experimentName}`, conversionEvent || null, siteId, timeRange.start, timeRange.end]);

  const variants = result.rows.map((r: any) => ({
    variant: r.variant,
    visitors: Number(r.visitors),
    sessions: Number(r.sessions),
    conversions: Number(r.conversions),
    conversionRate: Number(r.conversion_rate),
  }));

  // Calculate statistical significance (chi-square test)
  if (variants.length >= 2) {
    const control = variants[0];
    const test = variants[1];
    
    // Simplified chi-square test
    const totalVisitors = control.visitors + test.visitors;
    const totalConversions = control.conversions + test.conversions;
    const expectedControl = (control.visitors / totalVisitors) * totalConversions;
    const expectedTest = (test.visitors / totalVisitors) * totalConversions;
    
    const chiSquare = 
      Math.pow(control.conversions - expectedControl, 2) / expectedControl +
      Math.pow(test.conversions - expectedTest, 2) / expectedTest;
    
    // For 1 degree of freedom, chi-square > 3.84 is significant at 95% confidence
    const isSignificant = chiSquare > 3.84;
    const confidence = isSignificant ? 95 : Math.min(95, (chiSquare / 3.84) * 95);

    return {
      experimentName,
      variants,
      significance: {
        isSignificant,
        confidence: Math.round(confidence),
        chiSquare: Number(chiSquare.toFixed(3)),
      },
    };
  }

  return {
    experimentName,
    variants,
    significance: null,
  };
}

/**
 * Get Lifetime Value (LTV) analysis
 */
export async function getLTVAnalysis(
  siteId: string,
  timeRange: TimeRange,
  groupBy: 'channel' | 'segment' | 'cohort' = 'channel'
) {
  const pool = getPool();
  
  if (groupBy === 'channel') {
    const result = await pool.query(`
      WITH visitor_first_visit AS (
        SELECT 
          vid,
          MIN(ts) as first_visit_ts,
          COALESCE(utm_source, ref_domain, 'direct') as acquisition_channel
        FROM events_raw
        WHERE site_id = $1
        GROUP BY vid, COALESCE(utm_source, ref_domain, 'direct')
      ),
      visitor_revenue AS (
        SELECT 
          er.vid,
          SUM(COALESCE(er.value::NUMERIC, 0)) as total_revenue,
          COUNT(DISTINCT er.sid) as total_sessions,
          COUNT(DISTINCT DATE(er.ts)) as active_days
        FROM events_raw er
        WHERE er.site_id = $1
          AND er.ts >= $2
          AND er.ts <= $3
          AND er.event_type = 'event'
          AND er.event_name = 'purchase'
        GROUP BY er.vid
      )
      SELECT 
        vfv.acquisition_channel as channel,
        COUNT(DISTINCT vfv.vid)::INTEGER as visitors,
        COUNT(DISTINCT vr.vid)::INTEGER as paying_visitors,
        COALESCE(SUM(vr.total_revenue), 0)::NUMERIC as total_revenue,
        COALESCE(AVG(vr.total_revenue), 0)::NUMERIC as avg_ltv,
        COALESCE(AVG(vr.total_sessions), 0)::NUMERIC as avg_sessions,
        COALESCE(AVG(vr.active_days), 0)::NUMERIC as avg_active_days
      FROM visitor_first_visit vfv
      LEFT JOIN visitor_revenue vr ON vfv.vid = vr.vid
      WHERE vfv.first_visit_ts >= $2
        AND vfv.first_visit_ts <= $3
      GROUP BY vfv.acquisition_channel
      ORDER BY avg_ltv DESC
    `, [siteId, timeRange.start, timeRange.end]);

    return result.rows.map((r: any) => ({
      channel: r.channel,
      visitors: Number(r.visitors),
      payingVisitors: Number(r.paying_visitors),
      totalRevenue: Number(r.total_revenue),
      avgLTV: Number(r.avg_ltv),
      avgSessions: Number(r.avg_sessions),
      avgActiveDays: Number(r.avg_active_days),
    }));
  } else if (groupBy === 'cohort') {
    const result = await pool.query(`
      WITH visitor_cohorts AS (
        SELECT 
          vid,
          DATE(MIN(ts)) as cohort_date,
          SUM(COALESCE(value::NUMERIC, 0)) as total_revenue,
          COUNT(DISTINCT sid) as total_sessions
        FROM events_raw
        WHERE site_id = $1
          AND ts >= $2
          AND ts <= $3
        GROUP BY vid, DATE(MIN(ts))
      ),
      cohort_stats AS (
        SELECT 
          cohort_date,
          COUNT(DISTINCT vid)::INTEGER as visitors,
          COUNT(DISTINCT CASE WHEN total_revenue > 0 THEN vid END)::INTEGER as paying_visitors,
          SUM(total_revenue)::NUMERIC as total_revenue,
          AVG(total_revenue)::NUMERIC as avg_ltv,
          AVG(total_sessions)::NUMERIC as avg_sessions
        FROM visitor_cohorts
        GROUP BY cohort_date
      )
      SELECT * FROM cohort_stats
      ORDER BY cohort_date DESC
      LIMIT 90
    `, [siteId, timeRange.start, timeRange.end]);

    return result.rows.map((r: any) => ({
      cohortDate: r.cohort_date.toISOString().split('T')[0],
      visitors: Number(r.visitors),
      payingVisitors: Number(r.paying_visitors),
      totalRevenue: Number(r.total_revenue),
      avgLTV: Number(r.avg_ltv),
      avgSessions: Number(r.avg_sessions),
    }));
  }
  
  // Default: return empty array for unsupported groupBy
  return [];
}

/**
 * Get predictive LTV (based on early behavior patterns)
 */
export async function getPredictiveLTV(
  siteId: string,
  timeRange: TimeRange,
  daysSinceAcquisition: number = 30
) {
  const pool = getPool();
  
  const result = await pool.query(`
    WITH visitor_first_visit AS (
      SELECT 
        vid,
        MIN(ts) as first_visit_ts,
        DATE(MIN(ts)) as cohort_date
      FROM events_raw
      WHERE site_id = $1
      GROUP BY vid
    ),
    early_behavior AS (
      SELECT 
        vfv.vid,
        vfv.cohort_date,
        COUNT(DISTINCT er.sid)::INTEGER as sessions_in_period,
        COUNT(DISTINCT er.path)::INTEGER as unique_pages,
        COUNT(DISTINCT DATE(er.ts))::INTEGER as active_days,
        SUM(CASE WHEN er.event_type = 'event' AND er.value > 0 THEN er.value ELSE 0 END)::NUMERIC as early_revenue
      FROM visitor_first_visit vfv
      JOIN events_raw er ON vfv.vid = er.vid
      WHERE er.site_id = $1
        AND er.ts >= vfv.first_visit_ts
        AND er.ts <= vfv.first_visit_ts + INTERVAL '${daysSinceAcquisition} days'
        AND vfv.first_visit_ts >= $2
        AND vfv.first_visit_ts <= $3
      GROUP BY vfv.vid, vfv.cohort_date
    ),
    historical_ltv AS (
      SELECT 
        vfv.vid,
        SUM(COALESCE(er.value, 0))::NUMERIC as total_ltv
      FROM visitor_first_visit vfv
      JOIN events_raw er ON vfv.vid = er.vid
      WHERE er.site_id = $1
        AND er.event_type = 'event'
        AND er.value > 0
      GROUP BY vfv.vid
    )
    SELECT 
      eb.cohort_date,
      COUNT(DISTINCT eb.vid)::INTEGER as visitors,
      AVG(eb.sessions_in_period)::NUMERIC as avg_sessions,
      AVG(eb.unique_pages)::NUMERIC as avg_pages,
      AVG(eb.active_days)::NUMERIC as avg_active_days,
      AVG(COALESCE(ltv.total_ltv, 0))::NUMERIC as avg_actual_ltv,
      AVG(eb.early_revenue)::NUMERIC as avg_early_revenue
    FROM early_behavior eb
    LEFT JOIN historical_ltv ltv ON eb.vid = ltv.vid
    GROUP BY eb.cohort_date
    ORDER BY eb.cohort_date DESC
    LIMIT 90
  `, [siteId, timeRange.start, timeRange.end]);

  return result.rows.map((r: any) => ({
    cohortDate: r.cohort_date.toISOString().split('T')[0],
    visitors: Number(r.visitors),
    avgSessions: Math.round(Number(r.avg_sessions) * 100) / 100,
    avgPages: Math.round(Number(r.avg_pages) * 100) / 100,
    avgActiveDays: Math.round(Number(r.avg_active_days) * 100) / 100,
    avgActualLTV: Math.round(Number(r.avg_actual_ltv) * 100) / 100,
    avgEarlyRevenue: Math.round(Number(r.avg_early_revenue) * 100) / 100,
  }));
}

/**
 * Get goal conversion data
 */
export async function getGoalConversions(
  siteId: string,
  goalId: string,
  timeRange: TimeRange
) {
  const pool = getPool();
  
  // First get goal config using raw SQL
  const goalResult = await pool.query(
    'SELECT id, site_id, name, type, config, description, enabled FROM goals WHERE id = $1 AND site_id = $2 LIMIT 1',
    [goalId, siteId]
  );
  
  if (goalResult.rows.length === 0) {
    return [];
  }

  const goalConfig = goalResult.rows[0];
  let query = '';
  let params: any[] = [siteId, timeRange.start, timeRange.end];

  if (goalConfig.type === 'destination') {
    query = `
      SELECT 
        DATE(ts) as date,
        COUNT(DISTINCT sid)::INTEGER as conversions,
        COUNT(DISTINCT vid)::INTEGER as unique_visitors
      FROM events_raw
      WHERE site_id = $1
        AND ts >= $2
        AND ts <= $3
        AND path LIKE $4
        AND event_type = 'inc'
        AND event_name IS NULL
      GROUP BY DATE(ts)
      ORDER BY date ASC
    `;
    const config = typeof goalConfig.config === 'string' ? JSON.parse(goalConfig.config) : (goalConfig.config || {});
    params.push(`%${config.destination || ''}%`);
  } else if (goalConfig.type === 'event') {
    query = `
      SELECT 
        DATE(ts) as date,
        COUNT(DISTINCT sid)::INTEGER as conversions,
        COUNT(DISTINCT vid)::INTEGER as unique_visitors
      FROM events_raw
      WHERE site_id = $1
        AND ts >= $2
        AND ts <= $3
        AND event_type = 'event'
        AND event_name = $4
      GROUP BY DATE(ts)
      ORDER BY date ASC
    `;
    const config = typeof goalConfig.config === 'string' ? JSON.parse(goalConfig.config) : (goalConfig.config || {});
    params.push(config.eventName || '');
  } else if (goalConfig.type === 'duration') {
    query = `
      WITH session_durations AS (
        SELECT 
          sid,
          EXTRACT(EPOCH FROM (MAX(ts) - MIN(ts)))::INTEGER as duration_seconds
        FROM events_raw
        WHERE site_id = $1
          AND ts >= $2
          AND ts <= $3
        GROUP BY sid
        HAVING EXTRACT(EPOCH FROM (MAX(ts) - MIN(ts))) >= $4
      )
      SELECT 
        DATE(MIN(er.ts)) as date,
        COUNT(DISTINCT sd.sid)::INTEGER as conversions,
        COUNT(DISTINCT er.vid)::INTEGER as unique_visitors
      FROM events_raw er
      JOIN session_durations sd ON er.sid = sd.sid
      WHERE er.site_id = $1
        AND er.ts >= $2
        AND er.ts <= $3
      GROUP BY DATE(er.ts)
      ORDER BY date ASC
    `;
    const config = typeof goalConfig.config === 'string' ? JSON.parse(goalConfig.config) : (goalConfig.config || {});
    params.push(config.durationSeconds || 0);
  } else if (goalConfig.type === 'pages') {
    query = `
      WITH session_pages AS (
        SELECT 
          sid,
          COUNT(DISTINCT path)::INTEGER as page_count
        FROM events_raw
        WHERE site_id = $1
          AND ts >= $2
          AND ts <= $3
          AND event_type = 'inc'
          AND event_name IS NULL
        GROUP BY sid
        )
      SELECT 
        DATE(MIN(er.ts)) as date,
        COUNT(DISTINCT sp.sid)::INTEGER as conversions,
        COUNT(DISTINCT er.vid)::INTEGER as unique_visitors
      FROM events_raw er
      JOIN session_pages sp ON er.sid = sp.sid
      WHERE er.site_id = $1
        AND er.ts >= $2
        AND er.ts <= $3
        AND sp.page_count >= $4
      GROUP BY DATE(er.ts)
      ORDER BY date ASC
    `;
    const config = typeof goalConfig.config === 'string' ? JSON.parse(goalConfig.config) : (goalConfig.config || {});
    params.push(config.pagesPerSession || 0);
  }

  if (!query) {
    return [];
  }

  const result = await pool.query(query, params);
  return result.rows.map((r: any) => {
    // Handle date conversion - might be Date object or string
    let dateStr = '';
    if (r.date instanceof Date) {
      dateStr = r.date.toISOString().split('T')[0];
    } else if (typeof r.date === 'string') {
      dateStr = r.date.split('T')[0];
    } else {
      dateStr = String(r.date || '');
    }
    
    return {
      date: dateStr,
      conversions: Number(r.conversions || 0),
      uniqueVisitors: Number(r.unique_visitors || 0),
    };
  });
}

/**
 * Get goal completion funnel (steps leading to goal)
 */
export async function getGoalCompletionFunnel(
  siteId: string,
  goalId: string,
  timeRange: TimeRange,
  maxSteps: number = 5
) {
  const pool = getPool();
  const db = getDb();
  
  const goal = await db.select().from(goals).where(and(eq(goals.id, goalId), eq(goals.siteId, siteId))).limit(1);
  
  if (goal.length === 0) {
    return [];
  }

  const goalConfig = goal[0];
  let goalCondition = '';

  if (goalConfig.type === 'destination') {
    const config = goalConfig.config as { destination?: string };
    goalCondition = `path LIKE '%${config.destination || ''}%' AND event_type = 'inc' AND event_name IS NULL`;
  } else if (goalConfig.type === 'event') {
    const config = goalConfig.config as { eventName?: string };
    goalCondition = `event_type = 'event' AND event_name = '${config.eventName || ''}'`;
  } else {
    return [];
  }

  const result = await pool.query(`
    WITH goal_sessions AS (
      SELECT DISTINCT sid, MIN(ts) as goal_ts
      FROM events_raw
      WHERE site_id = $1
        AND ts >= $2
        AND ts <= $3
        AND ${goalCondition}
      GROUP BY sid
    ),
    session_paths AS (
      SELECT 
        er.sid,
        array_agg(DISTINCT er.path ORDER BY er.ts) FILTER (
          WHERE er.event_type = 'inc' 
          AND er.event_name IS NULL
          AND er.ts <= (SELECT goal_ts FROM goal_sessions gs WHERE gs.sid = er.sid)
        ) as pages
      FROM events_raw er
      WHERE er.site_id = $1
        AND er.ts >= $2
        AND er.ts <= $3
        AND er.sid IN (SELECT sid FROM goal_sessions)
      GROUP BY er.sid
    )
    SELECT 
      pages[1] as step1,
      CASE WHEN array_length(pages, 1) >= 2 THEN pages[2] ELSE NULL END as step2,
      CASE WHEN array_length(pages, 1) >= 3 THEN pages[3] ELSE NULL END as step3,
      CASE WHEN array_length(pages, 1) >= 4 THEN pages[4] ELSE NULL END as step4,
      CASE WHEN array_length(pages, 1) >= 5 THEN pages[5] ELSE NULL END as step5
    FROM session_paths
    WHERE array_length(pages, 1) > 0
  `, [siteId, timeRange.start, timeRange.end]);

  // Count occurrences of each path pattern
  const stepCounts: Record<string, number> = {};
  result.rows.forEach((r: any) => {
    const path = [r.step1, r.step2, r.step3, r.step4, r.step5].filter(Boolean).join(' -> ');
    if (path) {
      stepCounts[path] = (stepCounts[path] || 0) + 1;
    }
  });

  return Object.entries(stepCounts)
    .map(([path, count]) => ({ path, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, maxSteps);
}

/**
 * Get goal performance by segment/channel
 */
export async function getGoalPerformanceBySegment(
  siteId: string,
  goalId: string,
  timeRange: TimeRange,
  segmentType: 'channel' | 'device' | 'country' = 'channel'
) {
  const pool = getPool();
  const db = getDb();
  
  const goal = await db.select().from(goals).where(and(eq(goals.id, goalId), eq(goals.siteId, siteId))).limit(1);
  
  if (goal.length === 0) {
    return [];
  }

  const goalConfig = goal[0];
  let goalCondition = '';
  let segmentField = '';

  if (goalConfig.type === 'destination') {
    const config = goalConfig.config as { destination?: string };
    goalCondition = `path LIKE '%${config.destination || ''}%' AND event_type = 'inc' AND event_name IS NULL`;
  } else if (goalConfig.type === 'event') {
    const config = goalConfig.config as { eventName?: string };
    goalCondition = `event_type = 'event' AND event_name = '${config.eventName || ''}'`;
  } else {
    return [];
  }

  if (segmentType === 'channel') {
    segmentField = `
      CASE
        WHEN ref_domain IS NULL AND (utm_source IS NULL OR utm_source = '') THEN 'Direct'
        WHEN utm_medium = 'organic' OR (utm_source = 'google' AND utm_medium IS NULL) THEN 'Organic'
        WHEN utm_medium IN ('cpc', 'paid', 'ppc') THEN 'Paid'
        WHEN utm_medium IN ('social', 'social-media') OR utm_source IN ('facebook', 'twitter', 'linkedin', 'instagram') THEN 'Social'
        WHEN ref_domain IS NOT NULL THEN 'Referral'
        ELSE 'Other'
      END
    `;
  } else if (segmentType === 'device') {
    segmentField = `COALESCE(device_category, 'unknown')`;
  } else if (segmentType === 'country') {
    segmentField = `COALESCE(country, 'unknown')`;
  }

  const result = await pool.query(`
    WITH all_sessions AS (
      SELECT DISTINCT ON (sid)
        sid, 
        ${segmentField} as segment
      FROM events_raw
      WHERE site_id = $1
        AND ts >= $2
        AND ts <= $3
      ORDER BY sid, ts ASC
    ),
    goal_sessions AS (
      SELECT DISTINCT er.sid, 
        ${segmentField} as segment
      FROM events_raw er
      WHERE er.site_id = $1
        AND er.ts >= $2
        AND er.ts <= $3
        AND ${goalCondition}
    )
    SELECT 
      COALESCE(a.segment, 'unknown') as segment,
      COUNT(DISTINCT a.sid)::INTEGER as total_sessions,
      COUNT(DISTINCT g.sid)::INTEGER as goal_completions,
      CASE 
        WHEN COUNT(DISTINCT a.sid) > 0 
        THEN (COUNT(DISTINCT g.sid)::NUMERIC / COUNT(DISTINCT a.sid)) * 100 
        ELSE 0 
      END as conversion_rate
    FROM all_sessions a
    LEFT JOIN goal_sessions g ON a.sid = g.sid AND a.segment = g.segment
    GROUP BY a.segment
    ORDER BY goal_completions DESC
  `, [siteId, timeRange.start, timeRange.end]);

  return result.rows.map((r: any) => ({
    segment: r.segment,
    totalSessions: Number(r.total_sessions),
    goalCompletions: Number(r.goal_completions),
    conversionRate: Math.round(Number(r.conversion_rate) * 100) / 100,
  }));
}

/**
 * Get e-commerce product performance
 */
export async function getEcommerceProductPerformance(
  siteId: string,
  timeRange: TimeRange,
  limit: number = 20
) {
  const pool = getPool();
  
  const result = await pool.query(`
    SELECT 
      ei.item_id,
      ei.item_name,
      ei.item_category,
      ei.item_brand,
      SUM(ei.quantity)::INTEGER as total_quantity,
      COUNT(DISTINCT ei.event_id)::INTEGER as purchase_count,
      SUM(ei.revenue)::NUMERIC as total_revenue,
      AVG(ei.price)::NUMERIC as avg_price
    FROM ecommerce_items ei
    JOIN events_raw er ON ei.event_id = er.id
    WHERE ei.site_id = $1
      AND er.ts >= $2
      AND er.ts <= $3
    GROUP BY ei.item_id, ei.item_name, ei.item_category, ei.item_brand
    ORDER BY total_revenue DESC
    LIMIT $4
  `, [siteId, timeRange.start, timeRange.end, limit]);

  return result.rows.map((r: any) => ({
    itemId: r.item_id,
    itemName: r.item_name,
    itemCategory: r.item_category,
    itemBrand: r.item_brand,
    totalQuantity: Number(r.total_quantity),
    purchaseCount: Number(r.purchase_count),
    totalRevenue: Number(r.total_revenue),
    avgPrice: Number(r.avg_price),
  }));
}

/**
 * Detect anomalies in metrics using statistical methods
 */
export async function detectAnomalies(
  siteId: string,
  metric: 'pageviews' | 'sessions' | 'conversions' | 'revenue',
  timeRange: TimeRange,
  windowDays: number = 7
) {
  const pool = getPool();
  
  // Get historical data for baseline
  const baselineStart = new Date(timeRange.start);
  baselineStart.setDate(baselineStart.getDate() - windowDays);
  
  const result = await pool.query(`
    WITH daily_metrics AS (
      SELECT 
        DATE(ts) as date,
        ${metric === 'pageviews' 
          ? `COUNT(CASE WHEN event_type = 'inc' AND event_name IS NULL THEN 1 END)::INTEGER as value`
          : metric === 'sessions'
          ? `COUNT(DISTINCT sid)::INTEGER as value`
          : metric === 'conversions'
          ? `COUNT(CASE WHEN event_type = 'event' AND event_name = 'purchase' THEN 1 END)::INTEGER as value`
          : `COALESCE(SUM(CASE WHEN event_type = 'event' AND event_name = 'purchase' THEN value::NUMERIC ELSE 0 END), 0)::NUMERIC as value`
        }
      FROM events_raw
      WHERE site_id = $1
        AND ts >= $2
        AND ts <= $3
      GROUP BY DATE(ts)
    ),
    baseline_stats AS (
      SELECT 
        AVG(value)::NUMERIC as mean,
        STDDEV(value)::NUMERIC as stddev
      FROM daily_metrics
      WHERE date < $4
    )
    SELECT 
      dm.date,
      dm.value,
      bs.mean,
      bs.stddev,
      CASE 
        WHEN bs.stddev > 0 THEN ABS((dm.value - bs.mean) / bs.stddev)
        ELSE 0
      END as z_score
    FROM daily_metrics dm
    CROSS JOIN baseline_stats bs
    WHERE dm.date >= $4
    ORDER BY dm.date ASC
  `, [siteId, baselineStart, timeRange.end, timeRange.start]);

  const threshold = 2.5; // Z-score threshold for anomaly detection
  
  return result.rows.map((r: any) => ({
    date: r.date.toISOString().split('T')[0],
    value: Number(r.value),
    mean: Number(r.mean),
    stddev: Number(r.stddev),
    zScore: Number(r.z_score),
    isAnomaly: Number(r.z_score) > threshold,
    anomalyType: Number(r.z_score) > threshold 
      ? (Number(r.value) > Number(r.mean) ? 'spike' : 'drop')
      : null,
  }));
}

/**
 * Get enhanced path analysis with conversion paths
 */
export async function getConversionPaths(
  siteId: string,
  timeRange: TimeRange,
  conversionEvent: string = 'purchase',
  limit: number = 10
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
    session_paths AS (
      SELECT 
        er.sid,
        array_agg(er.path ORDER BY er.ts) as path_sequence
      FROM events_raw er
      JOIN conversion_sessions cs ON er.sid = cs.sid
      WHERE er.site_id = $1
        AND er.ts >= $2
        AND er.ts <= $3
        AND er.event_type = 'inc'
        AND er.event_name IS NULL
      GROUP BY er.sid
    ),
    path_patterns AS (
      SELECT 
        path_sequence,
        COUNT(*)::INTEGER as session_count
      FROM session_paths
      GROUP BY path_sequence
      ORDER BY session_count DESC
      LIMIT $5
    )
    SELECT 
      path_sequence,
      session_count
    FROM path_patterns
  `, [siteId, timeRange.start, timeRange.end, conversionEvent, limit]);

  return result.rows.map((r: any) => ({
    pathSequence: r.path_sequence,
    sessionCount: Number(r.session_count),
  }));
}

/**
 * Get hourly traffic patterns
 */
export async function getHourlyPatterns(siteId: string, timeRange: TimeRange) {
  const pool = getPool();
  
  const result = await pool.query(`
    SELECT 
      EXTRACT(HOUR FROM ts)::INTEGER as hour,
      COUNT(*)::INTEGER as count,
      COUNT(DISTINCT vid)::INTEGER as unique_visitors
    FROM events_raw
    WHERE site_id = $1 
      AND ts >= $2 
      AND ts <= $3
      AND event_type = 'inc'
      AND event_name IS NULL
    GROUP BY EXTRACT(HOUR FROM ts)
    ORDER BY hour
  `, [siteId, timeRange.start, timeRange.end]);

  return result.rows.map((r: any) => ({
    hour: Number(r.hour),
    count: Number(r.count),
    uniqueVisitors: Number(r.unique_visitors),
  }));
}

/**
 * Get daily traffic patterns (day of week)
 */
export async function getDailyPatterns(siteId: string, timeRange: TimeRange) {
  const pool = getPool();
  
  const result = await pool.query(`
    SELECT 
      EXTRACT(DOW FROM ts)::INTEGER as day_of_week,
      COUNT(*)::INTEGER as count,
      COUNT(DISTINCT vid)::INTEGER as unique_visitors
    FROM events_raw
    WHERE site_id = $1 
      AND ts >= $2 
      AND ts <= $3
      AND event_type = 'inc'
      AND event_name IS NULL
    GROUP BY EXTRACT(DOW FROM ts)
    ORDER BY day_of_week
  `, [siteId, timeRange.start, timeRange.end]);

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  
  return result.rows.map((r: any) => ({
    dayOfWeek: Number(r.day_of_week),
    dayName: dayNames[Number(r.day_of_week)],
    count: Number(r.count),
    uniqueVisitors: Number(r.unique_visitors),
  }));
}

/**
 * Get top referrers with quality metrics
 */
export async function getTopReferrersWithQuality(
  siteId: string,
  timeRange: TimeRange,
  limit: number = 10,
  filters: FilterConfig[] = []
) {
  const pool = getPool();
  const params: any[] = [siteId, timeRange.start, timeRange.end, limit];
  const { whereClause, params: filterParams } = applyFilters(filters, params.length + 1);
  params.push(...filterParams);
  
  const filterSql = whereClause ? ` AND ${whereClause}` : '';
  
  const result = await pool.query(`
    WITH referrer_stats AS (
      SELECT 
        COALESCE(ref_domain, 'direct') as referrer,
        COUNT(*)::INTEGER as pageviews,
        COUNT(DISTINCT vid)::INTEGER as unique_visitors,
        COUNT(DISTINCT sid)::INTEGER as sessions,
        COUNT(CASE WHEN EXISTS (
          SELECT 1 FROM events_raw e2 
          WHERE e2.sid = e.sid 
            AND e2.ts > e.ts 
            AND e2.ts <= e.ts + INTERVAL '30 minutes'
        ) THEN 1 END)::INTEGER as engaged_sessions,
        AVG(CASE WHEN EXISTS (
          SELECT 1 FROM events_raw e2 
          WHERE e2.sid = e.sid 
            AND e2.ts > e.ts 
            AND e2.ts <= e.ts + INTERVAL '30 minutes'
        ) THEN 1 ELSE 0 END)::NUMERIC as engagement_rate
      FROM events_raw e
      WHERE site_id = $1 
        AND ts >= $2 
        AND ts <= $3
        AND event_type = 'inc'
        AND event_name IS NULL
        ${filterSql}
      GROUP BY COALESCE(ref_domain, 'direct')
    )
    SELECT 
      referrer,
      pageviews,
      unique_visitors,
      sessions,
      engaged_sessions,
      engagement_rate
    FROM referrer_stats
    ORDER BY pageviews DESC
    LIMIT $4
  `, params);

  return result.rows.map((r: any) => ({
    referrer: r.referrer,
    pageviews: Number(r.pageviews),
    uniqueVisitors: Number(r.unique_visitors),
    sessions: Number(r.sessions),
    engagedSessions: Number(r.engaged_sessions),
    engagementRate: Number(r.engagement_rate || 0) * 100,
  }));
}

/**
 * Calculate engagement score (0-100)
 */
export async function getEngagementScore(
  siteId: string,
  timeRange: TimeRange,
  filters: FilterConfig[] = []
): Promise<number> {
  const sessionMetrics = await getSessionMetrics(siteId, timeRange, filters);
  const engagementMetrics = await getEngagementMetrics(siteId, timeRange, filters);
  
  // Normalize metrics to 0-100 scale
  // Bounce rate: lower is better (invert)
  const bounceScore = Math.max(0, 100 - sessionMetrics.bounceRate);
  
  // Session duration: normalize to 0-100 (assuming 5 minutes = 100)
  const durationScore = Math.min(100, (sessionMetrics.avgDurationSeconds / 300) * 100);
  
  // Pages per session: normalize to 0-100 (assuming 5 pages = 100)
  const pagesScore = Math.min(100, (engagementMetrics.avgPagesPerSession / 5) * 100);
  
  // Weighted average
  const engagementScore = (bounceScore * 0.4) + (durationScore * 0.3) + (pagesScore * 0.3);
  
  return Math.round(engagementScore * 100) / 100;
}

/**
 * Calculate traffic quality score (0-100)
 */
export async function getTrafficQualityScore(
  siteId: string,
  timeRange: TimeRange,
  filters: FilterConfig[] = []
): Promise<number> {
  const sessionMetrics = await getSessionMetrics(siteId, timeRange, filters);
  const engagementMetrics = await getEngagementMetrics(siteId, timeRange, filters);
  
  // Get conversion rate (simplified - would need actual conversion data)
  const pool = getPool();
  const params: any[] = [siteId, timeRange.start, timeRange.end];
  const { whereClause, params: filterParams } = applyFilters(filters, params.length + 1);
  params.push(...filterParams);
  const filterSql = whereClause ? ` AND ${whereClause}` : '';
  
  const conversionResult = await pool.query(`
    SELECT 
      COUNT(DISTINCT CASE WHEN event_type = 'event' AND event_name IN ('purchase', 'signup', 'conversion') THEN sid END)::INTEGER as converting_sessions,
      COUNT(DISTINCT sid)::INTEGER as total_sessions
    FROM events_raw
    WHERE site_id = $1 
      AND ts >= $2 
      AND ts <= $3
      ${filterSql}
  `, params);
  
  const conversionRate = conversionResult.rows[0]?.total_sessions > 0
    ? (conversionResult.rows[0].converting_sessions / conversionResult.rows[0].total_sessions) * 100
    : 0;
  
  // Normalize metrics
  const bounceScore = Math.max(0, 100 - sessionMetrics.bounceRate);
  const durationScore = Math.min(100, (sessionMetrics.avgDurationSeconds / 300) * 100);
  const conversionScore = Math.min(100, conversionRate * 10); // Scale conversion rate
  
  // Weighted average
  const qualityScore = (bounceScore * 0.3) + (durationScore * 0.3) + (conversionScore * 0.4);
  
  return Math.round(qualityScore * 100) / 100;
}

/**
 * Get goal progress for a site
 */
export async function getGoalProgress(siteId: string, timeRange: TimeRange) {
  const db = getDb();
  const pool = getPool();
  
  // Get all enabled goals
  const goalsList = await db
    .select()
    .from(goals)
    .where(and(eq(goals.siteId, siteId), eq(goals.enabled, true)));
  
  const progress = await Promise.all(
    goalsList.map(async (goal) => {
      let conversions = 0;
      
      if (goal.type === 'destination') {
        const result = await pool.query(`
          SELECT COUNT(DISTINCT sid)::INTEGER as conversions
          FROM events_raw
          WHERE site_id = $1 
            AND ts >= $2 
            AND ts <= $3
            AND path = $4
            AND event_type = 'inc'
        `, [siteId, timeRange.start, timeRange.end, (goal.config as any)?.destination || '']);
        conversions = result.rows[0]?.conversions || 0;
      } else if (goal.type === 'event') {
        const result = await pool.query(`
          SELECT COUNT(DISTINCT sid)::INTEGER as conversions
          FROM events_raw
          WHERE site_id = $1 
            AND ts >= $2 
            AND ts <= $3
            AND event_type = 'event'
            AND event_name = $4
        `, [siteId, timeRange.start, timeRange.end, (goal.config as any)?.eventName || '']);
        conversions = result.rows[0]?.conversions || 0;
      } else if (goal.type === 'duration') {
        const result = await pool.query(`
          SELECT COUNT(DISTINCT sid)::INTEGER as conversions
          FROM (
            SELECT 
              sid,
              EXTRACT(EPOCH FROM (MAX(ts) - MIN(ts))) as duration
            FROM events_raw
            WHERE site_id = $1 
              AND ts >= $2 
              AND ts <= $3
            GROUP BY sid
          ) session_durations
          WHERE duration >= $4
        `, [siteId, timeRange.start, timeRange.end, (goal.config as any)?.durationSeconds || 0]);
        conversions = result.rows[0]?.conversions || 0;
      } else if (goal.type === 'pages') {
        const result = await pool.query(`
          SELECT COUNT(DISTINCT sid)::INTEGER as conversions
          FROM (
            SELECT 
              sid,
              COUNT(*) as page_count
            FROM events_raw
            WHERE site_id = $1 
              AND ts >= $2 
              AND ts <= $3
              AND event_type = 'inc'
            GROUP BY sid
          ) session_pages
          WHERE page_count >= $4
        `, [siteId, timeRange.start, timeRange.end, (goal.config as any)?.pagesPerSession || 0]);
        conversions = result.rows[0]?.conversions || 0;
      }
      
      return {
        goalId: goal.id,
        goalName: goal.name,
        goalType: goal.type,
        conversions,
      };
    })
  );
  
  return progress;
}

/**
 * Get page performance metrics (bounce rate, time on page, exit rate)
 */
export async function getPagePerformanceMetrics(
  siteId: string,
  timeRange: TimeRange,
  limit: number = 20,
  filters: FilterConfig[] = []
) {
  const pool = getPool();
  const params: any[] = [siteId, timeRange.start, timeRange.end, limit];
  const { whereClause, params: filterParams } = applyFilters(filters, params.length + 1);
  params.push(...filterParams);
  const filterSql = whereClause ? ` AND ${whereClause}` : '';

  const result = await pool.query(`
    WITH page_stats AS (
      SELECT 
        path,
        COUNT(*)::INTEGER as pageviews,
        COUNT(DISTINCT vid)::INTEGER as unique_visitors,
        COUNT(DISTINCT sid)::INTEGER as sessions
      FROM events_raw
      WHERE site_id = $1 
        AND ts >= $2 
        AND ts <= $3
        AND event_type = 'inc'
        AND event_name IS NULL
        ${filterSql}
      GROUP BY path
    ),
    bounce_stats AS (
      SELECT 
        path,
        COUNT(DISTINCT sid)::INTEGER as bounced_sessions
      FROM events_raw e1
      WHERE site_id = $1 
        AND ts >= $2 
        AND ts <= $3
        AND event_type = 'inc'
        AND event_name IS NULL
        ${filterSql}
        AND NOT EXISTS (
          SELECT 1 FROM events_raw e2
          WHERE e2.sid = e1.sid
            AND e2.ts > e1.ts
            AND e2.ts <= e1.ts + INTERVAL '30 minutes'
        )
      GROUP BY path
    ),
    exit_stats AS (
      SELECT 
        path,
        COUNT(DISTINCT sid)::INTEGER as exit_sessions
      FROM events_raw e1
      WHERE site_id = $1 
        AND ts >= $2 
        AND ts <= $3
        AND event_type = 'inc'
        AND event_name IS NULL
        ${filterSql}
        AND e1.ts = (
          SELECT MAX(e2.ts) FROM events_raw e2
          WHERE e2.sid = e1.sid
            AND e2.ts >= $2
            AND e2.ts <= $3
        )
      GROUP BY path
    ),
    scroll_depth AS (
      SELECT 
        path,
        AVG(scroll_depth)::NUMERIC as avg_scroll_depth,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY scroll_depth)::NUMERIC as median_scroll_depth
      FROM events_raw
      WHERE site_id = $1 
        AND ts >= $2 
        AND ts <= $3
        AND scroll_depth IS NOT NULL
        ${filterSql}
      GROUP BY path
    )
    SELECT 
      ps.path,
      ps.pageviews,
      ps.unique_visitors,
      ps.sessions,
      COALESCE(bs.bounced_sessions, 0)::INTEGER as bounced_sessions,
      CASE WHEN ps.sessions > 0 
        THEN (COALESCE(bs.bounced_sessions, 0)::NUMERIC / ps.sessions) * 100 
        ELSE 0 
      END as bounce_rate,
      COALESCE(es.exit_sessions, 0)::INTEGER as exit_sessions,
      CASE WHEN ps.sessions > 0 
        THEN (COALESCE(es.exit_sessions, 0)::NUMERIC / ps.sessions) * 100 
        ELSE 0 
      END as exit_rate,
      COALESCE(sd.avg_scroll_depth, 0)::NUMERIC as avg_scroll_depth,
      COALESCE(sd.median_scroll_depth, 0)::NUMERIC as median_scroll_depth
    FROM page_stats ps
    LEFT JOIN bounce_stats bs ON ps.path = bs.path
    LEFT JOIN exit_stats es ON ps.path = es.path
    LEFT JOIN scroll_depth sd ON ps.path = sd.path
    ORDER BY ps.pageviews DESC
    LIMIT $4
  `, params);

  return result.rows.map((r: any) => ({
    path: r.path,
    pageviews: Number(r.pageviews),
    uniqueVisitors: Number(r.unique_visitors),
    sessions: Number(r.sessions),
    bouncedSessions: Number(r.bounced_sessions),
    bounceRate: Math.round(Number(r.bounce_rate) * 100) / 100,
    exitSessions: Number(r.exit_sessions),
    exitRate: Math.round(Number(r.exit_rate) * 100) / 100,
    avgScrollDepth: Math.round(Number(r.avg_scroll_depth) * 100) / 100,
    medianScrollDepth: Math.round(Number(r.median_scroll_depth) * 100) / 100,
  }));
}

/**
 * Get scroll depth distribution by page
 */
export async function getScrollDepthDistribution(
  siteId: string,
  timeRange: TimeRange,
  path?: string
) {
  const pool = getPool();
  const conditions = [siteId, timeRange.start, timeRange.end];
  const pathFilter = path ? ' AND path = $4' : '';
  if (path) conditions.push(path);

  const result = await pool.query(`
    SELECT 
      CASE 
        WHEN scroll_depth < 25 THEN '0-25%'
        WHEN scroll_depth < 50 THEN '25-50%'
        WHEN scroll_depth < 75 THEN '50-75%'
        WHEN scroll_depth < 100 THEN '75-100%'
        ELSE '100%'
      END as depth_range,
      COUNT(*)::INTEGER as count,
      COUNT(DISTINCT vid)::INTEGER as unique_visitors
    FROM events_raw
    WHERE site_id = $1 
      AND ts >= $2 
      AND ts <= $3
      AND scroll_depth IS NOT NULL
      ${pathFilter}
    GROUP BY depth_range
    ORDER BY 
      CASE depth_range
        WHEN '0-25%' THEN 1
        WHEN '25-50%' THEN 2
        WHEN '50-75%' THEN 3
        WHEN '75-100%' THEN 4
        WHEN '100%' THEN 5
      END
  `, conditions);

  return result.rows.map((r: any) => ({
    depthRange: r.depth_range,
    count: Number(r.count),
    uniqueVisitors: Number(r.unique_visitors),
  }));
}

/**
 * Get page value (revenue/value per page)
 */
export async function getPageValue(
  siteId: string,
  timeRange: TimeRange,
  limit: number = 20
) {
  const pool = getPool();

  const result = await pool.query(`
    WITH page_revenue AS (
      SELECT 
        e1.path,
        COUNT(DISTINCT e1.sid)::INTEGER as sessions,
        SUM(COALESCE(e2.value, 0))::NUMERIC as total_value,
        COUNT(DISTINCT CASE WHEN e2.value > 0 THEN e1.sid END)::INTEGER as converting_sessions
      FROM events_raw e1
      LEFT JOIN events_raw e2 ON e1.sid = e2.sid 
        AND e2.ts >= e1.ts 
        AND e2.ts <= e1.ts + INTERVAL '30 minutes'
        AND e2.event_type = 'event'
        AND e2.value > 0
      WHERE e1.site_id = $1 
        AND e1.ts >= $2 
        AND e1.ts <= $3
        AND e1.event_type = 'inc'
        AND e1.event_name IS NULL
      GROUP BY e1.path
    )
    SELECT 
      path,
      sessions,
      total_value,
      converting_sessions,
      CASE WHEN sessions > 0 
        THEN (total_value / sessions)::NUMERIC 
        ELSE 0 
      END as value_per_session
    FROM page_revenue
    WHERE total_value > 0
    ORDER BY total_value DESC
    LIMIT $4
  `, [siteId, timeRange.start, timeRange.end, limit]);

  return result.rows.map((r: any) => ({
    path: r.path,
    sessions: Number(r.sessions),
    totalValue: Number(r.total_value),
    convertingSessions: Number(r.converting_sessions),
    valuePerSession: Number(r.value_per_session),
  }));
}

/**
 * Get conversion rate trends over time
 */
export async function getConversionRateTrends(
  siteId: string,
  timeRange: TimeRange,
  conversionEvent: string = 'purchase'
) {
  const pool = getPool();
  
  const result = await pool.query(`
    WITH daily_stats AS (
      SELECT 
        DATE(ts) as date,
        COUNT(DISTINCT sid)::INTEGER as total_sessions,
        COUNT(DISTINCT CASE WHEN event_type = 'event' AND event_name = $4 THEN sid END)::INTEGER as converting_sessions
      FROM events_raw
      WHERE site_id = $1 
        AND ts >= $2 
        AND ts <= $3
      GROUP BY DATE(ts)
    )
    SELECT 
      date,
      total_sessions,
      converting_sessions,
      CASE WHEN total_sessions > 0 
        THEN (converting_sessions::NUMERIC / total_sessions) * 100 
        ELSE 0 
      END as conversion_rate
    FROM daily_stats
    ORDER BY date
  `, [siteId, timeRange.start, timeRange.end, conversionEvent]);

  return result.rows.map((r: any) => ({
    date: r.date,
    totalSessions: Number(r.total_sessions),
    convertingSessions: Number(r.converting_sessions),
    conversionRate: Math.round(Number(r.conversion_rate) * 100) / 100,
  }));
}

/**
 * Get conversion rate by channel
 */
export async function getConversionRateByChannel(
  siteId: string,
  timeRange: TimeRange,
  conversionEvent: string = 'purchase'
) {
  const pool = getPool();
  
  const result = await pool.query(`
    WITH channel_sessions AS (
      SELECT 
        COALESCE(
          CASE 
            WHEN ref_domain IS NULL OR ref_domain = '' THEN 'direct'
            WHEN ref_domain LIKE '%google%' THEN 'organic'
            WHEN ref_domain LIKE '%facebook%' OR ref_domain LIKE '%twitter%' OR ref_domain LIKE '%linkedin%' THEN 'social'
            ELSE 'referral'
          END,
          'direct'
        ) as channel,
        COUNT(DISTINCT sid)::INTEGER as total_sessions,
        COUNT(DISTINCT CASE WHEN EXISTS (
          SELECT 1 FROM events_raw e2
          WHERE e2.sid = e1.sid
            AND e2.event_type = 'event'
            AND e2.event_name = $4
        ) THEN sid END)::INTEGER as converting_sessions
      FROM events_raw e1
      WHERE site_id = $1 
        AND ts >= $2 
        AND ts <= $3
        AND event_type = 'inc'
      GROUP BY channel
    )
    SELECT 
      channel,
      total_sessions,
      converting_sessions,
      CASE WHEN total_sessions > 0 
        THEN (converting_sessions::NUMERIC / total_sessions) * 100 
        ELSE 0 
      END as conversion_rate
    FROM channel_sessions
    ORDER BY total_sessions DESC
  `, [siteId, timeRange.start, timeRange.end, conversionEvent]);

  return result.rows.map((r: any) => ({
    channel: r.channel,
    totalSessions: Number(r.total_sessions),
    convertingSessions: Number(r.converting_sessions),
    conversionRate: Math.round(Number(r.conversion_rate) * 100) / 100,
  }));
}

/**
 * Get conversion rate by device
 */
export async function getConversionRateByDevice(
  siteId: string,
  timeRange: TimeRange,
  conversionEvent: string = 'purchase'
) {
  const pool = getPool();
  
  const result = await pool.query(`
    WITH device_sessions AS (
      SELECT 
        COALESCE(device_category, 'unknown') as device_category,
        COUNT(DISTINCT sid)::INTEGER as total_sessions,
        COUNT(DISTINCT CASE WHEN EXISTS (
          SELECT 1 FROM events_raw e2
          WHERE e2.sid = e1.sid
            AND e2.event_type = 'event'
            AND e2.event_name = $4
        ) THEN sid END)::INTEGER as converting_sessions
      FROM events_raw e1
      WHERE site_id = $1 
        AND ts >= $2 
        AND ts <= $3
        AND event_type = 'inc'
      GROUP BY device_category
    )
    SELECT 
      device_category,
      total_sessions,
      converting_sessions,
      CASE WHEN total_sessions > 0 
        THEN (converting_sessions::NUMERIC / total_sessions) * 100 
        ELSE 0 
      END as conversion_rate
    FROM device_sessions
    ORDER BY total_sessions DESC
  `, [siteId, timeRange.start, timeRange.end, conversionEvent]);

  return result.rows.map((r: any) => ({
    deviceCategory: r.device_category,
    totalSessions: Number(r.total_sessions),
    convertingSessions: Number(r.converting_sessions),
    conversionRate: Math.round(Number(r.conversion_rate) * 100) / 100,
  }));
}

/**
 * Get average time to conversion
 */
export async function getTimeToConversion(
  siteId: string,
  timeRange: TimeRange,
  conversionEvent: string = 'purchase'
) {
  const pool = getPool();
  
  const result = await pool.query(`
    WITH conversion_times AS (
      SELECT 
        e1.sid,
        MIN(e1.ts) as first_visit,
        MIN(e2.ts) as conversion_time,
        EXTRACT(EPOCH FROM (MIN(e2.ts) - MIN(e1.ts))) / 3600 as hours_to_convert
      FROM events_raw e1
      INNER JOIN events_raw e2 ON e1.sid = e2.sid
        AND e2.event_type = 'event'
        AND e2.event_name = $4
        AND e2.ts >= e1.ts
      WHERE e1.site_id = $1 
        AND e1.ts >= $2 
        AND e1.ts <= $3
        AND e1.event_type = 'inc'
      GROUP BY e1.sid
    )
    SELECT 
      AVG(hours_to_convert)::NUMERIC as avg_hours,
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY hours_to_convert)::NUMERIC as median_hours,
      MIN(hours_to_convert)::NUMERIC as min_hours,
      MAX(hours_to_convert)::NUMERIC as max_hours
    FROM conversion_times
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
 * Get browser version breakdown
 */
export async function getBrowserBreakdown(
  siteId: string,
  timeRange: TimeRange,
  filters: FilterConfig[] = []
) {
  const pool = getPool();
  const params: any[] = [siteId, timeRange.start, timeRange.end];
  const { whereClause, params: filterParams } = applyFilters(filters, params.length + 1);
  params.push(...filterParams);
  const filterSql = whereClause ? ` AND ${whereClause}` : '';

  const result = await pool.query(`
    SELECT 
      COALESCE(browser_name, 'unknown') as browser_name,
      COALESCE(browser_version, 'unknown') as browser_version,
      COUNT(*)::INTEGER as count,
      COUNT(DISTINCT vid)::INTEGER as unique_visitors
    FROM events_raw
    WHERE site_id = $1 
      AND ts >= $2 
      AND ts <= $3
      AND event_type = 'inc'
      ${filterSql}
    GROUP BY browser_name, browser_version
    ORDER BY count DESC
    LIMIT 20
  `, params);

  return result.rows.map((r: any) => ({
    browserName: r.browser_name,
    browserVersion: r.browser_version,
    count: Number(r.count),
    uniqueVisitors: Number(r.unique_visitors),
  }));
}

/**
 * Get screen resolution breakdown
 */
export async function getScreenResolutionBreakdown(
  siteId: string,
  timeRange: TimeRange,
  filters: FilterConfig[] = []
) {
  const pool = getPool();
  const params: any[] = [siteId, timeRange.start, timeRange.end];
  const { whereClause, params: filterParams } = applyFilters(filters, params.length + 1);
  params.push(...filterParams);
  const filterSql = whereClause ? ` AND ${whereClause}` : '';

  const result = await pool.query(`
    SELECT 
      CONCAT(sw, 'x', sh) as resolution,
      COUNT(*)::INTEGER as count,
      COUNT(DISTINCT vid)::INTEGER as unique_visitors
    FROM events_raw
    WHERE site_id = $1 
      AND ts >= $2 
      AND ts <= $3
      AND sw IS NOT NULL
      AND sh IS NOT NULL
      AND event_type = 'inc'
      ${filterSql}
    GROUP BY sw, sh
    ORDER BY count DESC
    LIMIT 20
  `, params);

  return result.rows.map((r: any) => ({
    resolution: r.resolution,
    count: Number(r.count),
    uniqueVisitors: Number(r.unique_visitors),
  }));
}

/**
 * Get language breakdown
 */
export async function getLanguageBreakdown(
  siteId: string,
  timeRange: TimeRange,
  filters: FilterConfig[] = []
) {
  const pool = getPool();
  const params: any[] = [siteId, timeRange.start, timeRange.end];
  const { whereClause, params: filterParams } = applyFilters(filters, params.length + 1);
  params.push(...filterParams);
  const filterSql = whereClause ? ` AND ${whereClause}` : '';

  const result = await pool.query(`
    SELECT 
      COALESCE(language, 'unknown') as language,
      COUNT(*)::INTEGER as count,
      COUNT(DISTINCT vid)::INTEGER as unique_visitors
    FROM events_raw
    WHERE site_id = $1 
      AND ts >= $2 
      AND ts <= $3
      AND event_type = 'inc'
      ${filterSql}
    GROUP BY language
    ORDER BY count DESC
    LIMIT 20
  `, params);

  return result.rows.map((r: any) => ({
    language: r.language,
    count: Number(r.count),
    uniqueVisitors: Number(r.unique_visitors),
  }));
}

/**
 * Get connection type breakdown
 */
export async function getConnectionTypeBreakdown(
  siteId: string,
  timeRange: TimeRange,
  filters: FilterConfig[] = []
) {
  const pool = getPool();
  const params: any[] = [siteId, timeRange.start, timeRange.end];
  const { whereClause, params: filterParams } = applyFilters(filters, params.length + 1);
  params.push(...filterParams);
  const filterSql = whereClause ? ` AND ${whereClause}` : '';

  const result = await pool.query(`
    SELECT 
      COALESCE(connection_type, 'unknown') as connection_type,
      COUNT(*)::INTEGER as count,
      COUNT(DISTINCT vid)::INTEGER as unique_visitors
    FROM events_raw
    WHERE site_id = $1 
      AND ts >= $2 
      AND ts <= $3
      AND event_type = 'inc'
      ${filterSql}
    GROUP BY connection_type
    ORDER BY count DESC
  `, params);

  return result.rows.map((r: any) => ({
    connectionType: r.connection_type,
    count: Number(r.count),
    uniqueVisitors: Number(r.unique_visitors),
  }));
}

/**
 * Get city-level geography (requires country filter for performance)
 */
export async function getCityBreakdown(
  siteId: string,
  timeRange: TimeRange,
  country?: string,
  limit: number = 20,
  filters: FilterConfig[] = []
) {
  const pool = getPool();
  const params: any[] = [siteId, timeRange.start, timeRange.end];
  const { whereClause, params: filterParams } = applyFilters(filters, params.length + 1);
  params.push(...filterParams);
  const filterSql = whereClause ? ` AND ${whereClause}` : '';
  const countryFilter = country ? ` AND country = $${params.length + 1}` : '';
  if (country) params.push(country);

  // Note: This assumes city data is available in custom dimensions or props
  // For now, we'll return a placeholder structure
  const result = await pool.query(`
    SELECT 
      country,
      COUNT(*)::INTEGER as count,
      COUNT(DISTINCT vid)::INTEGER as unique_visitors
    FROM events_raw
    WHERE site_id = $1 
      AND ts >= $2 
      AND ts <= $3
      AND event_type = 'inc'
      ${filterSql}
      ${countryFilter}
    GROUP BY country
    ORDER BY count DESC
    LIMIT $${params.length + 1}
  `, [...params, limit]);

  return result.rows.map((r: any) => ({
    country: r.country,
    count: Number(r.count),
    uniqueVisitors: Number(r.unique_visitors),
  }));
}

/**
 * Get user frequency analysis (how often users visit)
 */
export async function getUserFrequencyAnalysis(
  siteId: string,
  timeRange: TimeRange,
  filters: FilterConfig[] = []
) {
  const pool = getPool();
  const params: any[] = [siteId, timeRange.start, timeRange.end];
  const { whereClause, params: filterParams } = applyFilters(filters, params.length + 1);
  params.push(...filterParams);
  const filterSql = whereClause ? ` AND ${whereClause}` : '';

  const result = await pool.query(`
    WITH visitor_sessions AS (
      SELECT 
        vid,
        COUNT(DISTINCT DATE(ts)) as visit_days
      FROM events_raw
      WHERE site_id = $1 
        AND ts >= $2 
        AND ts <= $3
        AND event_type = 'inc'
        ${filterSql}
      GROUP BY vid
    )
    SELECT 
      CASE 
        WHEN visit_days = 1 THEN '1 day'
        WHEN visit_days <= 7 THEN '2-7 days'
        WHEN visit_days <= 30 THEN '8-30 days'
        ELSE '31+ days'
      END as frequency_category,
      COUNT(*)::INTEGER as visitor_count,
      AVG(visit_days)::NUMERIC as avg_visit_days
    FROM visitor_sessions
    GROUP BY frequency_category
    ORDER BY 
      CASE frequency_category
        WHEN '1 day' THEN 1
        WHEN '2-7 days' THEN 2
        WHEN '8-30 days' THEN 3
        WHEN '31+ days' THEN 4
      END
  `, params);

  return result.rows.map((r: any) => ({
    frequencyCategory: r.frequency_category,
    visitorCount: Number(r.visitor_count),
    avgVisitDays: Math.round(Number(r.avg_visit_days) * 100) / 100,
  }));
}

/**
 * Get recency analysis (days since last visit)
 */
export async function getRecencyAnalysis(
  siteId: string,
  timeRange: TimeRange,
  filters: FilterConfig[] = []
) {
  const pool = getPool();
  const params: any[] = [siteId, timeRange.start, timeRange.end];
  const { whereClause, params: filterParams } = applyFilters(filters, params.length + 1);
  params.push(...filterParams);
  const filterSql = whereClause ? ` AND ${whereClause}` : '';

  const result = await pool.query(`
    WITH visitor_last_visit AS (
      SELECT 
        vid,
        MAX(DATE(ts)) as last_visit_date
      FROM events_raw
      WHERE site_id = $1 
        AND ts >= $2 
        AND ts <= $3
        AND event_type = 'inc'
        ${filterSql}
      GROUP BY vid
    ),
    recency_calc AS (
      SELECT 
        vid,
        last_visit_date,
        (CURRENT_DATE - last_visit_date)::INTEGER as days_since_visit
      FROM visitor_last_visit
    )
    SELECT 
      CASE 
        WHEN days_since_visit = 0 THEN 'Today'
        WHEN days_since_visit = 1 THEN 'Yesterday'
        WHEN days_since_visit <= 7 THEN '2-7 days'
        WHEN days_since_visit <= 30 THEN '8-30 days'
        WHEN days_since_visit <= 90 THEN '31-90 days'
        ELSE '90+ days'
      END as recency_category,
      COUNT(*)::INTEGER as visitor_count
    FROM recency_calc
    GROUP BY recency_category
    ORDER BY 
      CASE recency_category
        WHEN 'Today' THEN 1
        WHEN 'Yesterday' THEN 2
        WHEN '2-7 days' THEN 3
        WHEN '8-30 days' THEN 4
        WHEN '31-90 days' THEN 5
        WHEN '90+ days' THEN 6
      END
  `, params);

  return result.rows.map((r: any) => ({
    recencyCategory: r.recency_category,
    visitorCount: Number(r.visitor_count),
  }));
}

/**
 * Get timezone analysis (when users are most active by timezone)
 */
export async function getTimezoneAnalysis(
  siteId: string,
  timeRange: TimeRange,
  filters: FilterConfig[] = []
) {
  const pool = getPool();
  const params: any[] = [siteId, timeRange.start, timeRange.end];
  const { whereClause, params: filterParams } = applyFilters(filters, params.length + 1);
  params.push(...filterParams);
  const filterSql = whereClause ? ` AND ${whereClause}` : '';

  // Group by hour of day (UTC) - in production, you'd want to convert to user's timezone
  const result = await pool.query(`
    SELECT 
      EXTRACT(HOUR FROM ts)::INTEGER as hour_utc,
      COUNT(*)::INTEGER as count,
      COUNT(DISTINCT vid)::INTEGER as unique_visitors
    FROM events_raw
    WHERE site_id = $1 
      AND ts >= $2 
      AND ts <= $3
      AND event_type = 'inc'
      ${filterSql}
    GROUP BY EXTRACT(HOUR FROM ts)
    ORDER BY hour_utc
  `, params);

  return result.rows.map((r: any) => ({
    hourUTC: Number(r.hour_utc),
    count: Number(r.count),
    uniqueVisitors: Number(r.unique_visitors),
  }));
}

/**
 * Get channel quality score (bounce rate, engagement, conversion)
 */
export async function getChannelQualityScore(
  siteId: string,
  timeRange: TimeRange,
  filters: FilterConfig[] = []
) {
  const pool = getPool();
  const params: any[] = [siteId, timeRange.start, timeRange.end];
  const { whereClause, params: filterParams } = applyFilters(filters, params.length + 1);
  params.push(...filterParams);
  const filterSql = whereClause ? ` AND ${whereClause}` : '';

  const result = await pool.query(`
    WITH channel_sessions AS (
      SELECT 
        CASE
          WHEN ref_domain IS NULL AND (utm_source IS NULL OR utm_source = '') THEN 'Direct'
          WHEN utm_medium = 'organic' OR (utm_source = 'google' AND utm_medium IS NULL) THEN 'Organic'
          WHEN utm_medium IN ('cpc', 'paid', 'ppc') THEN 'Paid'
          WHEN utm_medium IN ('social', 'social-media') OR utm_source IN ('facebook', 'twitter', 'linkedin', 'instagram') THEN 'Social'
          WHEN ref_domain IS NOT NULL THEN 'Referral'
          ELSE 'Other'
        END as channel,
        sid,
        COUNT(*)::INTEGER as pageviews,
        MIN(ts) as start_time,
        MAX(ts) as end_time
      FROM events_raw
      WHERE site_id = $1 
        AND ts >= $2 
        AND ts <= $3
        AND event_type = 'inc'
        ${filterSql}
      GROUP BY channel, sid
    ),
    channel_metrics AS (
      SELECT 
        channel,
        COUNT(DISTINCT sid)::INTEGER as total_sessions,
        COUNT(CASE WHEN pageviews = 1 THEN 1 END)::INTEGER as bounced_sessions,
        AVG(EXTRACT(EPOCH FROM (end_time - start_time)))::NUMERIC as avg_duration,
        COUNT(DISTINCT CASE WHEN EXISTS (
          SELECT 1 FROM events_raw e2
          WHERE e2.sid = cs.sid
            AND e2.event_type = 'event'
            AND e2.event_name IN ('purchase', 'signup', 'conversion')
        ) THEN cs.sid END)::INTEGER as converting_sessions
      FROM channel_sessions cs
      GROUP BY channel
    )
    SELECT 
      channel,
      total_sessions,
      bounced_sessions,
      CASE WHEN total_sessions > 0 
        THEN (bounced_sessions::NUMERIC / total_sessions) * 100 
        ELSE 0 
      END as bounce_rate,
      avg_duration,
      converting_sessions,
      CASE WHEN total_sessions > 0 
        THEN (converting_sessions::NUMERIC / total_sessions) * 100 
        ELSE 0 
      END as conversion_rate
    FROM channel_metrics
    ORDER BY total_sessions DESC
  `, params);

  return result.rows.map((r: any) => {
    const bounceScore = Math.max(0, 100 - Number(r.bounce_rate));
    const durationScore = Math.min(100, (Number(r.avg_duration) / 300) * 100);
    const conversionScore = Math.min(100, Number(r.conversion_rate) * 10);
    const qualityScore = (bounceScore * 0.3) + (durationScore * 0.3) + (conversionScore * 0.4);

    return {
      channel: r.channel,
      totalSessions: Number(r.total_sessions),
      bouncedSessions: Number(r.bounced_sessions),
      bounceRate: Math.round(Number(r.bounce_rate) * 100) / 100,
      avgDuration: Math.round(Number(r.avg_duration) * 100) / 100,
      convertingSessions: Number(r.converting_sessions),
      conversionRate: Math.round(Number(r.conversion_rate) * 100) / 100,
      qualityScore: Math.round(qualityScore * 100) / 100,
    };
  });
}

/**
 * Get acquisition trends over time
 */
export async function getAcquisitionTrends(
  siteId: string,
  timeRange: TimeRange,
  filters: FilterConfig[] = []
) {
  const pool = getPool();
  const params: any[] = [siteId, timeRange.start, timeRange.end];
  const { whereClause, params: filterParams } = applyFilters(filters, params.length + 1);
  params.push(...filterParams);
  const filterSql = whereClause ? ` AND ${whereClause}` : '';

  const result = await pool.query(`
    SELECT 
      DATE(ts) as date,
      CASE
        WHEN ref_domain IS NULL AND (utm_source IS NULL OR utm_source = '') THEN 'Direct'
        WHEN utm_medium = 'organic' OR (utm_source = 'google' AND utm_medium IS NULL) THEN 'Organic'
        WHEN utm_medium IN ('cpc', 'paid', 'ppc') THEN 'Paid'
        WHEN utm_medium IN ('social', 'social-media') OR utm_source IN ('facebook', 'twitter', 'linkedin', 'instagram') THEN 'Social'
        WHEN ref_domain IS NOT NULL THEN 'Referral'
        ELSE 'Other'
      END as channel,
      COUNT(DISTINCT sid)::INTEGER as sessions,
      COUNT(DISTINCT vid)::INTEGER as visitors
    FROM events_raw
    WHERE site_id = $1 
      AND ts >= $2 
      AND ts <= $3
      AND event_type = 'inc'
      ${filterSql}
    GROUP BY DATE(ts), channel
    ORDER BY date, channel
  `, params);

  // Group by date
  const trendsByDate: Record<string, Record<string, { sessions: number; visitors: number }>> = {};
  
  result.rows.forEach((r: any) => {
    const date = r.date.toISOString().split('T')[0];
    if (!trendsByDate[date]) {
      trendsByDate[date] = {};
    }
    trendsByDate[date][r.channel] = {
      sessions: Number(r.sessions),
      visitors: Number(r.visitors),
    };
  });

  return Object.entries(trendsByDate).map(([date, channels]) => ({
    date,
    channels,
  }));
}

/**
 * Get referrer quality metrics
 */
export async function getReferrerQuality(
  siteId: string,
  timeRange: TimeRange,
  limit: number = 20,
  filters: FilterConfig[] = []
) {
  const pool = getPool();
  const params: any[] = [siteId, timeRange.start, timeRange.end];
  const { whereClause, params: filterParams } = applyFilters(filters, params.length + 1);
  params.push(...filterParams);
  const filterSql = whereClause ? ` AND ${whereClause}` : '';

  const result = await pool.query(`
    WITH referrer_sessions AS (
      SELECT 
        COALESCE(ref_domain, 'direct') as referrer,
        sid,
        COUNT(*)::INTEGER as pageviews,
        MIN(ts) as start_time,
        MAX(ts) as end_time
      FROM events_raw
      WHERE site_id = $1 
        AND ts >= $2 
        AND ts <= $3
        AND event_type = 'inc'
        ${filterSql}
      GROUP BY ref_domain, sid
    ),
    referrer_metrics AS (
      SELECT 
        referrer,
        COUNT(DISTINCT sid)::INTEGER as total_sessions,
        COUNT(CASE WHEN pageviews = 1 THEN 1 END)::INTEGER as bounced_sessions,
        AVG(EXTRACT(EPOCH FROM (end_time - start_time)))::NUMERIC as avg_duration,
        COUNT(DISTINCT CASE WHEN EXISTS (
          SELECT 1 FROM events_raw e2
          WHERE e2.sid = rs.sid
            AND e2.event_type = 'event'
            AND e2.event_name IN ('purchase', 'signup', 'conversion')
        ) THEN rs.sid END)::INTEGER as converting_sessions
      FROM referrer_sessions rs
      GROUP BY referrer
    )
    SELECT 
      referrer,
      total_sessions,
      bounced_sessions,
      CASE WHEN total_sessions > 0 
        THEN (bounced_sessions::NUMERIC / total_sessions) * 100 
        ELSE 0 
      END as bounce_rate,
      avg_duration,
      converting_sessions,
      CASE WHEN total_sessions > 0 
        THEN (converting_sessions::NUMERIC / total_sessions) * 100 
        ELSE 0 
      END as conversion_rate
    FROM referrer_metrics
    WHERE total_sessions >= 10
    ORDER BY total_sessions DESC
    LIMIT $${params.length + 1}
  `, [...params, limit]);

  return result.rows.map((r: any) => ({
    referrer: r.referrer,
    totalSessions: Number(r.total_sessions),
    bouncedSessions: Number(r.bounced_sessions),
    bounceRate: Math.round(Number(r.bounce_rate) * 100) / 100,
    avgDuration: Math.round(Number(r.avg_duration) * 100) / 100,
    convertingSessions: Number(r.converting_sessions),
    conversionRate: Math.round(Number(r.conversion_rate) * 100) / 100,
  }));
}

/**
 * Get paid vs organic comparison
 */
export async function getPaidVsOrganic(
  siteId: string,
  timeRange: TimeRange,
  filters: FilterConfig[] = []
) {
  const pool = getPool();
  const params: any[] = [siteId, timeRange.start, timeRange.end];
  const { whereClause, params: filterParams } = applyFilters(filters, params.length + 1);
  params.push(...filterParams);
  const filterSql = whereClause ? ` AND ${whereClause}` : '';

  const result = await pool.query(`
    WITH session_first_event AS (
      SELECT DISTINCT ON (sid)
        sid,
        vid,
        CASE
          WHEN utm_medium IN ('cpc', 'paid', 'ppc') THEN 'Paid'
          WHEN utm_medium = 'organic' OR (utm_source = 'google' AND utm_medium IS NULL) THEN 'Organic'
          ELSE 'Other'
        END as traffic_type
      FROM events_raw
      WHERE site_id = $1 
        AND ts >= $2 
        AND ts <= $3
        AND event_type = 'inc'
        ${filterSql}
      ORDER BY sid, ts ASC
    ),
    session_metrics AS (
      SELECT 
        sfe.traffic_type,
        COUNT(DISTINCT sfe.sid)::INTEGER as total_sessions,
        COUNT(DISTINCT sfe.vid)::INTEGER as total_visitors,
        COUNT(DISTINCT CASE WHEN (
          SELECT COUNT(*) FROM events_raw e2 
          WHERE e2.sid = sfe.sid 
            AND e2.event_type = 'inc'
        ) = 1 THEN sfe.sid END)::INTEGER as bounced_sessions,
        AVG((
          SELECT EXTRACT(EPOCH FROM (MAX(e3.ts) - MIN(e3.ts)))
          FROM events_raw e3
          WHERE e3.sid = sfe.sid
        ))::NUMERIC as avg_duration,
        COUNT(DISTINCT CASE WHEN EXISTS (
          SELECT 1 FROM events_raw e4
          WHERE e4.sid = sfe.sid
            AND e4.event_type = 'event'
            AND e4.event_name IN ('purchase', 'signup', 'conversion')
        ) THEN sfe.sid END)::INTEGER as converting_sessions
      FROM session_first_event sfe
      GROUP BY sfe.traffic_type
    )
    SELECT 
      traffic_type,
      total_sessions,
      total_visitors,
      bounced_sessions,
      CASE WHEN total_sessions > 0 
        THEN (bounced_sessions::NUMERIC / total_sessions) * 100 
        ELSE 0 
      END as bounce_rate,
      COALESCE(avg_duration, 0)::NUMERIC as avg_duration,
      converting_sessions,
      CASE WHEN total_sessions > 0 
        THEN (converting_sessions::NUMERIC / total_sessions) * 100 
        ELSE 0 
      END as conversion_rate
    FROM session_metrics
    WHERE traffic_type IN ('Paid', 'Organic')
    ORDER BY traffic_type
  `, params);

  return result.rows.map((r: any) => ({
    trafficType: r.traffic_type,
    totalSessions: Number(r.total_sessions),
    totalVisitors: Number(r.total_visitors),
    bouncedSessions: Number(r.bounced_sessions),
    bounceRate: Math.round(Number(r.bounce_rate) * 100) / 100,
    avgDuration: Math.round(Number(r.avg_duration) * 100) / 100,
    convertingSessions: Number(r.converting_sessions),
    conversionRate: Math.round(Number(r.conversion_rate) * 100) / 100,
  }));
}

/**
 * Get multi-channel funnel data
 */
export async function getMultiChannelFunnel(
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
    session_channels AS (
      SELECT 
        er.sid,
        CASE
          WHEN ref_domain IS NULL AND (utm_source IS NULL OR utm_source = '') THEN 'Direct'
          WHEN utm_medium = 'organic' OR (utm_source = 'google' AND utm_medium IS NULL) THEN 'Organic'
          WHEN utm_medium IN ('cpc', 'paid', 'ppc') THEN 'Paid'
          WHEN utm_medium IN ('social', 'social-media') OR utm_source IN ('facebook', 'twitter', 'linkedin', 'instagram') THEN 'Social'
          WHEN ref_domain IS NOT NULL THEN 'Referral'
          ELSE 'Other'
        END as channel,
        er.ts,
        ROW_NUMBER() OVER (PARTITION BY er.sid ORDER BY er.ts ASC) as rn_first,
        ROW_NUMBER() OVER (PARTITION BY er.sid ORDER BY er.ts DESC) as rn_last
      FROM events_raw er
      WHERE er.site_id = $1
        AND er.ts >= $2
        AND er.ts <= $3
        AND er.sid IN (SELECT sid FROM conversion_sessions)
    ),
    channel_roles AS (
      SELECT 
        channel,
        COUNT(DISTINCT CASE WHEN rn_first = 1 THEN sid END)::INTEGER as first_touch,
        COUNT(DISTINCT CASE WHEN rn_last = 1 THEN sid END)::INTEGER as last_touch,
        COUNT(DISTINCT sid)::INTEGER as interactions
      FROM session_channels
      GROUP BY channel
    ),
    assisted_conversions AS (
      SELECT 
        sc.channel,
        COUNT(DISTINCT sc.sid)::INTEGER as assisted_count
      FROM session_channels sc
      WHERE sc.rn_first > 1 AND sc.rn_last > 1
      GROUP BY sc.channel
    )
    SELECT 
      cr.channel,
      cr.interactions,
      cr.first_touch,
      COALESCE(ac.assisted_count, 0)::INTEGER as assisted,
      cr.last_touch,
      cr.first_touch + COALESCE(ac.assisted_count, 0) + cr.last_touch as total_conversions
    FROM channel_roles cr
    LEFT JOIN assisted_conversions ac ON cr.channel = ac.channel
    ORDER BY cr.interactions DESC
  `, [siteId, timeRange.start, timeRange.end, conversionEvent]);

  return result.rows.map((r: any) => ({
    channel: r.channel,
    interactions: Number(r.interactions),
    firstTouch: Number(r.first_touch),
    assisted: Number(r.assisted),
    lastTouch: Number(r.last_touch),
    totalConversions: Number(r.total_conversions),
  }));
}

/**
 * Get multi-channel path analysis
 */
export async function getMCFPathAnalysis(
  siteId: string,
  timeRange: TimeRange,
  conversionEvent: string = 'purchase',
  limit: number = 20
) {
  const pool = getPool();
  
  // Simplified version - return top paths by conversion count
  // For production, consider using a more efficient approach with path hashing
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
    session_channels AS (
      SELECT DISTINCT
        er.sid,
        CASE
          WHEN ref_domain IS NULL AND (utm_source IS NULL OR utm_source = '') THEN 'Direct'
          WHEN utm_medium = 'organic' OR (utm_source = 'google' AND utm_medium IS NULL) THEN 'Organic'
          WHEN utm_medium IN ('cpc', 'paid', 'ppc') THEN 'Paid'
          WHEN utm_medium IN ('social', 'social-media') OR utm_source IN ('facebook', 'twitter', 'linkedin', 'instagram') THEN 'Social'
          WHEN ref_domain IS NOT NULL THEN 'Referral'
          ELSE 'Other'
        END as channel
      FROM events_raw er
      WHERE er.site_id = $1
        AND er.ts >= $2
        AND er.ts <= $3
        AND er.sid IN (SELECT sid FROM conversion_sessions)
    )
    SELECT 
      channel,
      COUNT(DISTINCT sid)::INTEGER as conversion_count
    FROM session_channels
    GROUP BY channel
    ORDER BY conversion_count DESC
    LIMIT $5
  `, [siteId, timeRange.start, timeRange.end, conversionEvent, limit]);

  return result.rows.map((r: any) => ({
    path: [r.channel],
    conversionCount: Number(r.conversion_count),
    avgPathLength: 1,
  }));
}

/**
 * Get channel interaction matrix
 */
export async function getChannelInteractionMatrix(
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
    session_channels AS (
      SELECT DISTINCT
        er.sid,
        CASE
          WHEN ref_domain IS NULL AND (utm_source IS NULL OR utm_source = '') THEN 'Direct'
          WHEN utm_medium = 'organic' OR (utm_source = 'google' AND utm_medium IS NULL) THEN 'Organic'
          WHEN utm_medium IN ('cpc', 'paid', 'ppc') THEN 'Paid'
          WHEN utm_medium IN ('social', 'social-media') OR utm_source IN ('facebook', 'twitter', 'linkedin', 'instagram') THEN 'Social'
          WHEN ref_domain IS NOT NULL THEN 'Referral'
          ELSE 'Other'
        END as channel
      FROM events_raw er
      WHERE er.site_id = $1
        AND er.ts >= $2
        AND er.ts <= $3
        AND er.sid IN (SELECT sid FROM conversion_sessions)
    ),
    channel_pairs AS (
      SELECT 
        sc1.channel as channel1,
        sc2.channel as channel2,
        COUNT(DISTINCT sc1.sid)::INTEGER as interaction_count
      FROM session_channels sc1
      JOIN session_channels sc2 ON sc1.sid = sc2.sid AND sc1.channel < sc2.channel
      GROUP BY sc1.channel, sc2.channel
    )
    SELECT 
      channel1,
      channel2,
      interaction_count
    FROM channel_pairs
    ORDER BY interaction_count DESC
    LIMIT 50
  `, [siteId, timeRange.start, timeRange.end, conversionEvent]);

  return result.rows.map((r: any) => ({
    channel1: r.channel1,
    channel2: r.channel2,
    interactionCount: Number(r.interaction_count),
  }));
}

/**
 * Get Core Web Vitals trends
 */
export async function getCoreWebVitalsTrends(
  siteId: string,
  timeRange: TimeRange
) {
  const pool = getPool();
  
  const result = await pool.query(`
    SELECT 
      DATE(ts) as date,
      AVG(lcp)::INTEGER as avg_lcp,
      PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY lcp)::INTEGER as p75_lcp,
      AVG(fid)::INTEGER as avg_fid,
      PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY fid)::INTEGER as p75_fid,
      AVG(cls)::NUMERIC as avg_cls,
      PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY cls)::NUMERIC as p75_cls,
      AVG(fcp)::INTEGER as avg_fcp,
      AVG(ttfb)::INTEGER as avg_ttfb,
      COUNT(*)::INTEGER as sample_count
    FROM events_raw
    WHERE site_id = $1
      AND ts >= $2
      AND ts <= $3
      AND (lcp IS NOT NULL OR fid IS NOT NULL OR cls IS NOT NULL)
    GROUP BY DATE(ts)
    ORDER BY date ASC
  `, [siteId, timeRange.start, timeRange.end]);

  return result.rows.map((r: any) => ({
    date: r.date.toISOString().split('T')[0],
    lcp: {
      avg: Number(r.avg_lcp || 0),
      p75: Number(r.p75_lcp || 0),
    },
    fid: {
      avg: Number(r.avg_fid || 0),
      p75: Number(r.p75_fid || 0),
    },
    cls: {
      avg: Math.round(Number(r.avg_cls || 0) * 1000) / 1000,
      p75: Math.round(Number(r.p75_cls || 0) * 1000) / 1000,
    },
    fcp: Number(r.avg_fcp || 0),
    ttfb: Number(r.avg_ttfb || 0),
    sampleCount: Number(r.sample_count),
  }));
}

/**
 * Get resource performance analysis
 */
export async function getResourcePerformance(
  siteId: string,
  timeRange: TimeRange,
  limit: number = 20
) {
  const pool = getPool();
  
  // Note: This assumes resource data is stored in props or custom dimensions
  // For now, return a placeholder structure
  const result = await pool.query(`
    SELECT 
      path,
      AVG(EXTRACT(EPOCH FROM (MAX(ts) - MIN(ts))))::NUMERIC as avg_load_time,
      COUNT(*)::INTEGER as pageviews,
      COUNT(DISTINCT vid)::INTEGER as unique_visitors
    FROM events_raw
    WHERE site_id = $1
      AND ts >= $2
      AND ts <= $3
      AND event_type = 'inc'
      AND event_name IS NULL
    GROUP BY path
    ORDER BY avg_load_time DESC
    LIMIT $4
  `, [siteId, timeRange.start, timeRange.end, limit]);

  return result.rows.map((r: any) => ({
    path: r.path,
    avgLoadTime: Math.round(Number(r.avg_load_time) * 100) / 100,
    pageviews: Number(r.pageviews),
    uniqueVisitors: Number(r.unique_visitors),
  }));
}

/**
 * Get performance error correlation
 */
export async function getPerformanceErrorCorrelation(
  siteId: string,
  timeRange: TimeRange
) {
  const pool = getPool();
  
  const result = await pool.query(`
    WITH performance_data AS (
      SELECT 
        path,
        AVG(lcp)::INTEGER as avg_lcp,
        AVG(fid)::INTEGER as avg_fid,
        AVG(cls)::NUMERIC as avg_cls,
        COUNT(CASE WHEN error_type IS NOT NULL THEN 1 END)::INTEGER as error_count,
        COUNT(*)::INTEGER as total_events
      FROM events_raw
      WHERE site_id = $1
        AND ts >= $2
        AND ts <= $3
        AND event_type = 'inc'
        AND event_name IS NULL
      GROUP BY path
    )
    SELECT 
      path,
      avg_lcp,
      avg_fid,
      avg_cls,
      error_count,
      total_events,
      CASE WHEN total_events > 0 
        THEN (error_count::NUMERIC / total_events) * 100 
        ELSE 0 
      END as error_rate
    FROM performance_data
    WHERE total_events >= 10
    ORDER BY error_rate DESC, avg_lcp DESC
    LIMIT 20
  `, [siteId, timeRange.start, timeRange.end]);

  return result.rows.map((r: any) => ({
    path: r.path,
    avgLCP: Number(r.avg_lcp || 0),
    avgFID: Number(r.avg_fid || 0),
    avgCLS: Math.round(Number(r.avg_cls || 0) * 1000) / 1000,
    errorCount: Number(r.error_count),
    totalEvents: Number(r.total_events),
    errorRate: Math.round(Number(r.error_rate) * 100) / 100,
  }));
}

/**
 * Get form field-level detailed analysis
 */
export async function getFormFieldAnalysis(
  siteId: string,
  timeRange: TimeRange,
  formId?: string
) {
  const pool = getPool();
  const params: any[] = [siteId, timeRange.start, timeRange.end];
  const formFilter = formId ? ` AND form_id = $${params.length + 1}` : '';
  if (formId) params.push(formId);

  const result = await pool.query(`
    SELECT 
      form_id,
      field_name,
      COUNT(*)::INTEGER as total_interactions,
      COUNT(DISTINCT sid)::INTEGER as unique_sessions,
      AVG(time_spent)::INTEGER as avg_time_spent,
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY time_spent)::INTEGER as median_time_spent,
      SUM(error_count)::INTEGER as total_errors,
      COUNT(CASE WHEN error_count > 0 THEN 1 END)::INTEGER as sessions_with_errors,
      COUNT(CASE WHEN event_type = 'blur' THEN 1 END)::INTEGER as blur_count,
      COUNT(CASE WHEN event_type = 'focus' THEN 1 END)::INTEGER as focus_count
    FROM form_analytics
    WHERE site_id = $1
      AND ts >= $2
      AND ts <= $3
      AND field_name IS NOT NULL
      ${formFilter}
    GROUP BY form_id, field_name
    ORDER BY total_errors DESC, avg_time_spent DESC
  `, params);

  return result.rows.map((r: any) => ({
    formId: r.form_id,
    fieldName: r.field_name,
    totalInteractions: Number(r.total_interactions),
    uniqueSessions: Number(r.unique_sessions),
    avgTimeSpent: Number(r.avg_time_spent || 0),
    medianTimeSpent: Number(r.median_time_spent || 0),
    totalErrors: Number(r.total_errors),
    sessionsWithErrors: Number(r.sessions_with_errors),
    blurCount: Number(r.blur_count),
    focusCount: Number(r.focus_count),
    errorRate: r.total_interactions > 0 
      ? Math.round((Number(r.sessions_with_errors) / Number(r.total_interactions)) * 10000) / 100
      : 0,
  }));
}

/**
 * Get form completion time analysis
 */
export async function getFormCompletionTime(
  siteId: string,
  timeRange: TimeRange,
  formId?: string
) {
  const pool = getPool();
  const params: any[] = [siteId, timeRange.start, timeRange.end];
  const formFilter = formId ? ` AND form_id = $${params.length + 1}` : '';
  if (formId) params.push(formId);

  const result = await pool.query(`
    WITH form_sessions AS (
      SELECT 
        sid,
        form_id,
        MIN(CASE WHEN event_type = 'focus' THEN ts END) as start_time,
        MAX(CASE WHEN event_type = 'submit' THEN ts END) as submit_time,
        MAX(CASE WHEN event_type = 'abandon' THEN ts END) as abandon_time
      FROM form_analytics
      WHERE site_id = $1
        AND ts >= $2
        AND ts <= $3
        ${formFilter}
      GROUP BY sid, form_id
    )
    SELECT 
      form_id,
      COUNT(DISTINCT CASE WHEN submit_time IS NOT NULL THEN sid END)::INTEGER as completed,
      COUNT(DISTINCT CASE WHEN abandon_time IS NOT NULL THEN sid END)::INTEGER as abandoned,
      AVG(EXTRACT(EPOCH FROM (submit_time - start_time)))::INTEGER as avg_completion_time,
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (submit_time - start_time)))::INTEGER as median_completion_time,
      AVG(EXTRACT(EPOCH FROM (abandon_time - start_time)))::INTEGER as avg_abandon_time
    FROM form_sessions
    WHERE start_time IS NOT NULL
    GROUP BY form_id
  `, params);

  return result.rows.map((r: any) => ({
    formId: r.form_id,
    completed: Number(r.completed),
    abandoned: Number(r.abandoned),
    avgCompletionTime: Number(r.avg_completion_time || 0),
    medianCompletionTime: Number(r.median_completion_time || 0),
    avgAbandonTime: Number(r.avg_abandon_time || 0),
  }));
}

/**
 * Get form error patterns
 */
export async function getFormErrorPatterns(
  siteId: string,
  timeRange: TimeRange,
  formId?: string,
  limit: number = 20
) {
  const pool = getPool();
  const params: any[] = [siteId, timeRange.start, timeRange.end];
  const formFilter = formId ? ` AND form_id = $${params.length + 1}` : '';
  if (formId) params.push(formId);

  const result = await pool.query(`
    SELECT 
      form_id,
      field_name,
      error_type,
      COUNT(*)::INTEGER as error_count,
      COUNT(DISTINCT sid)::INTEGER as affected_sessions
    FROM form_analytics
    WHERE site_id = $1
      AND ts >= $2
      AND ts <= $3
      AND error_count > 0
      AND error_type IS NOT NULL
      ${formFilter}
    GROUP BY form_id, field_name, error_type
    ORDER BY error_count DESC
    LIMIT $${params.length + 1}
  `, [...params, limit]);

  return result.rows.map((r: any) => ({
    formId: r.form_id,
    fieldName: r.field_name,
    errorType: r.error_type,
    errorCount: Number(r.error_count),
    affectedSessions: Number(r.affected_sessions),
  }));
}

/**
 * Get Errors report enhancements - error trends over time
 */
export async function getErrorTrends(
  siteId: string,
  timeRange: TimeRange,
  errorType?: string
) {
  const pool = getPool();
  const params: any[] = [siteId, timeRange.start, timeRange.end];
  const typeFilter = errorType ? ` AND error_type = $${params.length + 1}` : '';
  if (errorType) params.push(errorType);

  const result = await pool.query(`
    SELECT 
      DATE(ts) as date,
      error_type,
      COUNT(*)::INTEGER as error_count,
      COUNT(DISTINCT vid)::INTEGER as affected_users,
      COUNT(DISTINCT path)::INTEGER as affected_pages
    FROM events_raw
    WHERE site_id = $1
      AND ts >= $2
      AND ts <= $3
      AND error_type IS NOT NULL
      ${typeFilter}
    GROUP BY DATE(ts), error_type
    ORDER BY date ASC, error_count DESC
  `, params);

  return result.rows.map((r: any) => ({
    date: r.date.toISOString().split('T')[0],
    errorType: r.error_type,
    errorCount: Number(r.error_count),
    affectedUsers: Number(r.affected_users),
    affectedPages: Number(r.affected_pages),
  }));
}

/**
 * Get error resolution tracking
 */
export async function getErrorResolutionTracking(
  siteId: string,
  timeRange: TimeRange
) {
  const pool = getPool();
  
  const result = await pool.query(`
    WITH error_fingerprints AS (
      SELECT 
        error_type,
        error_message,
        COUNT(*)::INTEGER as total_occurrences,
        COUNT(DISTINCT vid)::INTEGER as affected_users,
        MIN(ts) as first_seen,
        MAX(ts) as last_seen,
        COUNT(DISTINCT DATE(ts))::INTEGER as days_active
      FROM events_raw
      WHERE site_id = $1
        AND ts >= $2
        AND ts <= $3
        AND error_type IS NOT NULL
      GROUP BY error_type, error_message
    )
    SELECT 
      error_type,
      error_message,
      total_occurrences,
      affected_users,
      first_seen,
      last_seen,
      days_active,
      CASE 
        WHEN last_seen < CURRENT_DATE - INTERVAL '7 days' THEN 'resolved'
        WHEN last_seen < CURRENT_DATE - INTERVAL '1 day' THEN 'inactive'
        ELSE 'active'
      END as status
    FROM error_fingerprints
    ORDER BY total_occurrences DESC
    LIMIT 50
  `, [siteId, timeRange.start, timeRange.end]);

  return result.rows.map((r: any) => ({
    errorType: r.error_type,
    errorMessage: r.error_message,
    totalOccurrences: Number(r.total_occurrences),
    affectedUsers: Number(r.affected_users),
    firstSeen: r.first_seen.toISOString(),
    lastSeen: r.last_seen.toISOString(),
    daysActive: Number(r.days_active),
    status: r.status,
  }));
}

/**
 * Get frustration signal patterns
 */
export async function getFrustrationPatterns(
  siteId: string,
  timeRange: TimeRange,
  signalType?: 'rage_click' | 'dead_click' | 'error_click'
) {
  const pool = getPool();
  const params: any[] = [siteId, timeRange.start, timeRange.end];
  
  // Note: Frustration signals would typically be stored in custom events or props
  // This is a placeholder structure - adjust based on actual data schema
  const result = await pool.query(`
    SELECT 
      path,
      COUNT(*)::INTEGER as frustration_count,
      COUNT(DISTINCT vid)::INTEGER as affected_users,
      COUNT(DISTINCT sid)::INTEGER as affected_sessions
    FROM events_raw
    WHERE site_id = $1
      AND ts >= $2
      AND ts <= $3
      AND event_type = 'event'
      AND event_name IN ('rage_click', 'dead_click', 'error_click')
      ${signalType ? ` AND event_name = $${params.length + 1}` : ''}
    GROUP BY path
    ORDER BY frustration_count DESC
    LIMIT 20
  `, signalType ? [...params, signalType] : params);

  return result.rows.map((r: any) => ({
    path: r.path,
    frustrationCount: Number(r.frustration_count),
    affectedUsers: Number(r.affected_users),
    affectedSessions: Number(r.affected_sessions),
  }));
}

/**
 * Get cohort comparison analysis
 */
export async function getCohortComparison(
  siteId: string,
  timeRange: TimeRange,
  cohortType: 'acquisition' | 'event' = 'acquisition',
  eventName?: string
) {
  const pool = getPool();
  
  // Get cohort data
  const cohortData = await getCohortAnalysis(siteId, cohortType, eventName, timeRange);
  
  if (!cohortData || !cohortData.cohorts) {
    return [];
  }

  // Calculate comparison metrics
  return cohortData.cohorts.map((cohort, idx) => {
    const previousCohort = idx < cohortData.cohorts.length - 1 ? cohortData.cohorts[idx + 1] : null;
    
    return {
      cohortDate: cohort.cohortDate,
      data: cohort.data.map((dayData: any) => {
        const prevDayData = previousCohort?.data.find((d: any) => 
          (cohortType === 'acquisition' && 'daysSinceAcquisition' in d && 'daysSinceAcquisition' in dayData && d.daysSinceAcquisition === dayData.daysSinceAcquisition) ||
          (cohortType === 'event' && 'daysSinceEvent' in d && 'daysSinceEvent' in dayData && d.daysSinceEvent === dayData.daysSinceEvent)
        );
        
        return {
          ...dayData,
          changeFromPrevious: prevDayData 
            ? {
                sessions: dayData.sessions - prevDayData.sessions,
                visitors: dayData.visitors - prevDayData.visitors,
                sessionsPercent: prevDayData.sessions > 0 
                  ? ((dayData.sessions - prevDayData.sessions) / prevDayData.sessions) * 100 
                  : 0,
              }
            : null,
        };
      }),
    };
  });
}

/**
 * Get retention trends over time
 */
export async function getRetentionTrends(
  siteId: string,
  timeRange: TimeRange,
  retentionDays: number[] = [1, 7, 30]
) {
  const pool = getPool();
  
  const result = await pool.query(`
    WITH visitor_first_visit AS (
      SELECT 
        vid,
        DATE(MIN(ts)) as first_visit_date
      FROM events_raw
      WHERE site_id = $1
      GROUP BY vid
    ),
    retention_by_cohort AS (
      SELECT 
        vfv.first_visit_date as cohort_date,
        ${retentionDays.map((d, i) => `
          COUNT(DISTINCT CASE 
            WHEN DATE(er.ts) = vfv.first_visit_date + INTERVAL '${d} days' THEN er.vid 
          END)::INTEGER as d${d}_retained
        `).join(',')},
        COUNT(DISTINCT CASE WHEN DATE(er.ts) = vfv.first_visit_date THEN er.vid END)::INTEGER as d0_total
      FROM visitor_first_visit vfv
      JOIN events_raw er ON vfv.vid = er.vid
      WHERE er.site_id = $1
        AND er.ts >= $2
        AND er.ts <= $3
        AND vfv.first_visit_date >= $2::DATE - INTERVAL '90 days'
      GROUP BY vfv.first_visit_date
    )
    SELECT 
      cohort_date,
      d0_total,
      ${retentionDays.map((d) => `
        CASE WHEN d0_total > 0 
          THEN (d${d}_retained::NUMERIC / d0_total) * 100 
          ELSE 0 
        END as d${d}_retention
      `).join(',')}
    FROM retention_by_cohort
    ORDER BY cohort_date DESC
    LIMIT 90
  `, [siteId, timeRange.start, timeRange.end]);

  return result.rows.map((r: any) => {
    const retention: Record<number, number> = {};
    retentionDays.forEach((d) => {
      retention[d] = Math.round(Number(r[`d${d}_retention`] || 0) * 100) / 100;
    });

    return {
      cohortDate: r.cohort_date.toISOString().split('T')[0],
      d0Total: Number(r.d0_total),
      retention,
    };
  });
}

// Re-export attribution functions
export { getAttributionData, type AttributionModel, type AttributionDataPoint } from './queries-attribution';

