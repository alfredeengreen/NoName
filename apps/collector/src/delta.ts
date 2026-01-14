import { getDb } from '@analytics/db';
import { baselines, eventsRaw, rollupMinute } from '@analytics/db';
import { eq, and, sql, gte, lte } from 'drizzle-orm';
import { nanoid } from 'nanoid';

export interface MetricBaseline {
  metricName: string;
  metricType: 'funnel' | 'event' | 'performance' | 'error';
  baselineValue: number;
  currentValue: number;
  delta: number;
  deltaPercent: number;
  zScore?: number;
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Compute baseline for a metric (last 7 days average)
 */
async function computeBaseline(
  siteId: string,
  metricName: string,
  metricType: 'funnel' | 'event' | 'performance' | 'error',
  now: Date
): Promise<number> {
  const db = getDb();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  let baseline = 0;

  if (metricType === 'event') {
    // Count events from events_raw
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(eventsRaw)
      .where(
        and(
          eq(eventsRaw.siteId, siteId),
          gte(eventsRaw.ts, sevenDaysAgo),
          lte(eventsRaw.ts, now),
          eq(eventsRaw.eventName, metricName)
        )
      );
    baseline = Number(result[0]?.count || 0) / 7; // Average per day
  } else if (metricType === 'funnel') {
    // For funnels, compute conversion rate
    // This is simplified - would need funnel step definitions
    baseline = 0; // Placeholder
  } else if (metricType === 'performance') {
    // Average performance metric (e.g., p95 duration)
    const result = await db
      .select({ p95: sql<number>`percentile_cont(0.95) within group (order by duration)` })
      .from(rollupMinute)
      .where(
        and(
          eq(rollupMinute.siteId, siteId),
          gte(rollupMinute.minuteTs, sevenDaysAgo),
          lte(rollupMinute.minuteTs, now)
        )
      );
    baseline = Number(result[0]?.p95 || 0);
  }

  return baseline;
}

/**
 * Compute current value for a metric (last 1 day)
 */
async function computeCurrent(
  siteId: string,
  metricName: string,
  metricType: 'funnel' | 'event' | 'performance' | 'error',
  now: Date
): Promise<number> {
  const db = getDb();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  let current = 0;

  if (metricType === 'event') {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(eventsRaw)
      .where(
        and(
          eq(eventsRaw.siteId, siteId),
          gte(eventsRaw.ts, oneDayAgo),
          lte(eventsRaw.ts, now),
          eq(eventsRaw.eventName, metricName)
        )
      );
    current = Number(result[0]?.count || 0);
  } else if (metricType === 'performance') {
    const result = await db
      .select({ p95: sql<number>`percentile_cont(0.95) within group (order by duration)` })
      .from(rollupMinute)
      .where(
        and(
          eq(rollupMinute.siteId, siteId),
          gte(rollupMinute.minuteTs, oneDayAgo),
          lte(rollupMinute.minuteTs, now)
        )
      );
    current = Number(result[0]?.p95 || 0);
  }

  return current;
}

/**
 * Compute z-score for statistical confidence
 */
function computeZScore(current: number, baseline: number, baselineStdDev?: number): number {
  if (baseline === 0) return 0;
  if (!baselineStdDev) {
    // Estimate std dev as 10% of baseline (simplified)
    baselineStdDev = baseline * 0.1;
  }
  if (baselineStdDev === 0) return 0;
  return (current - baseline) / baselineStdDev;
}

/**
 * Determine confidence level from z-score
 */
function getConfidence(zScore: number): 'high' | 'medium' | 'low' {
  const absZ = Math.abs(zScore);
  if (absZ >= 2) return 'high';
  if (absZ >= 1) return 'medium';
  return 'low';
}

/**
 * Compute delta for a single metric
 */
export async function computeMetricDelta(
  siteId: string,
  metricName: string,
  metricType: 'funnel' | 'event' | 'performance' | 'error'
): Promise<MetricBaseline | null> {
  const now = new Date();
  const baseline = await computeBaseline(siteId, metricName, metricType, now);
  const current = await computeCurrent(siteId, metricName, metricType, now);

  if (baseline === 0 && current === 0) {
    return null; // No data
  }

  const delta = current - baseline;
  const deltaPercent = baseline !== 0 ? (delta / baseline) * 100 : 0;
  const zScore = computeZScore(current, baseline);
  const confidence = getConfidence(zScore);

  return {
    metricName,
    metricType,
    baselineValue: baseline,
    currentValue: current,
    delta,
    deltaPercent,
    zScore,
    confidence,
  };
}

/**
 * Compute deltas for key metrics and store in baselines table
 */
export async function computeAllDeltas(siteId: string): Promise<void> {
  const db = getDb();
  const now = new Date();

  // Key metrics to track
  const keyMetrics = [
    { name: 'purchase', type: 'event' as const },
    { name: 'signup', type: 'event' as const },
    { name: 'error', type: 'error' as const },
    // Add more as needed
  ];

  for (const metric of keyMetrics) {
    const delta = await computeMetricDelta(siteId, metric.name, metric.type);
    if (!delta) continue;

    // Store or update baseline
    const existing = await db
      .select()
      .from(baselines)
      .where(
        and(
          eq(baselines.siteId, siteId),
          eq(baselines.metricName, metric.name),
          eq(baselines.metricType, metric.type)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(baselines)
        .set({
          baselineValue: delta.baselineValue.toString(),
          currentValue: delta.currentValue.toString(),
          delta: delta.delta.toString(),
          deltaPercent: delta.deltaPercent.toString(),
          zScore: delta.zScore?.toString(),
          confidence: delta.confidence,
          computedAt: now,
          updatedAt: now,
        })
        .where(eq(baselines.id, existing[0].id));
    } else {
      await db.insert(baselines).values({
        id: nanoid(),
        siteId,
        metricName: metric.name,
        metricType: metric.type,
        baselineValue: delta.baselineValue.toString(),
        baselinePeriodDays: 7,
        currentValue: delta.currentValue.toString(),
        currentPeriodDays: 1,
        delta: delta.delta.toString(),
        deltaPercent: delta.deltaPercent.toString(),
        zScore: delta.zScore?.toString(),
        confidence: delta.confidence,
        computedAt: now,
      });
    }
  }
}
