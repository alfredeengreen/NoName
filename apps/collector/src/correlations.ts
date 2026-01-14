import { getDb } from '@analytics/db';
import { correlations, eventsRaw, errors, errorEvents, performanceMetrics, formAnalytics } from '@analytics/db';
import { eq, and, sql, gte, lte } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { calculateConversionLift, twoProportionZTest } from './statistics.js';

/**
 * Compute error impact correlation
 * Compares conversion rate for sessions with errors vs without errors
 */
export async function computeErrorImpact(siteId: string): Promise<void> {
  const db = getDb();
  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // Get sessions with errors
  const sessionsWithErrors = await db
    .selectDistinct({ sid: eventsRaw.sid })
    .from(eventsRaw)
    .innerJoin(errorEvents, eq(eventsRaw.sid, errorEvents.sid))
    .where(
      and(
        eq(eventsRaw.siteId, siteId),
        gte(eventsRaw.ts, dayAgo)
      )
    );

  const errorSessionIds = new Set(sessionsWithErrors.map(r => r.sid));

  // Get conversion events (purchase, signup, etc.)
  const conversionEvents = await db
    .select({ sid: eventsRaw.sid })
    .from(eventsRaw)
    .where(
      and(
        eq(eventsRaw.siteId, siteId),
        gte(eventsRaw.ts, dayAgo),
        sql`event_name IN ('purchase', 'signup', 'conversion')`
      )
    );

  const conversionSessions = new Set(conversionEvents.map(r => r.sid));

  // Calculate conversion rates
  const totalSessions = await db
    .selectDistinct({ sid: eventsRaw.sid })
    .from(eventsRaw)
    .where(
      and(
        eq(eventsRaw.siteId, siteId),
        gte(eventsRaw.ts, dayAgo)
      )
    );

  const totalSessionCount = totalSessions.length;
  const errorSessionCount = errorSessionIds.size;
  const noErrorSessionCount = totalSessionCount - errorSessionCount;

  let conversionRateWith = 0;
  let conversionRateWithout = 0;

  if (errorSessionCount > 0) {
    const conversionsWithError = Array.from(errorSessionIds).filter(sid => conversionSessions.has(sid)).length;
    conversionRateWith = (conversionsWithError / errorSessionCount) * 100;
  }

  if (noErrorSessionCount > 0) {
    const conversionsWithoutError = Array.from(conversionSessions).filter(sid => !errorSessionIds.has(sid)).length;
    conversionRateWithout = (conversionsWithoutError / noErrorSessionCount) * 100;
  }

  // Calculate conversion lift with confidence intervals
  const conversionsWithError = Array.from(errorSessionIds).filter(sid => conversionSessions.has(sid)).length;
  const conversionsWithoutError = Array.from(conversionSessions).filter(sid => !errorSessionIds.has(sid)).length;

  const liftResult = calculateConversionLift(
    conversionsWithError,
    errorSessionCount,
    conversionsWithoutError,
    noErrorSessionCount
  );

  // Calculate statistical significance
  const significanceTest = twoProportionZTest(
    conversionsWithError,
    errorSessionCount,
    conversionsWithoutError,
    noErrorSessionCount
  );

  // Store correlation value as lift in percentage points (normalized to -1 to 1)
  const correlationValue = liftResult.lift / 100; // Normalize percentage points to decimal
  const affectedSessions = errorSessionCount;

  // Store or update correlation
  const existing = await db
    .select()
    .from(correlations)
    .where(
      and(
        eq(correlations.siteId, siteId),
        eq(correlations.correlationType, 'error_impact'),
        eq(correlations.metric1, 'error_count'),
        eq(correlations.metric2, 'conversion_rate')
      )
    )
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(correlations)
      .set({
        correlationValue: correlationValue.toString(),
        pValue: significanceTest.pValue.toString(),
        affectedSessions,
        conversionRateWith: liftResult.rateA.toString(),
        conversionRateWithout: liftResult.rateB.toString(),
        computedAt: now,
        metadata: {
          lift: liftResult.lift,
          liftPercent: liftResult.liftPercent,
          confidenceInterval: liftResult.confidenceInterval,
          significant: liftResult.significant,
          rateAInterval: liftResult.rateAInterval,
          rateBInterval: liftResult.rateBInterval,
        },
      })
      .where(eq(correlations.id, existing[0].id));
  } else {
    const correlationId = nanoid();
    await db.insert(correlations).values({
      id: correlationId,
      siteId,
      correlationType: 'error_impact',
      metric1: 'error_count',
      metric2: 'conversion_rate',
      correlationValue: correlationValue.toString(),
      pValue: significanceTest.pValue.toString(),
      affectedSessions,
      conversionRateWith: liftResult.rateA.toString(),
      conversionRateWithout: liftResult.rateB.toString(),
      computedAt: now,
      metadata: {
        lift: liftResult.lift,
        liftPercent: liftResult.liftPercent,
        confidenceInterval: liftResult.confidenceInterval,
        significant: liftResult.significant,
        rateAInterval: liftResult.rateAInterval,
        rateBInterval: liftResult.rateBInterval,
      },
    });
  }
}

/**
 * Compute performance impact correlation
 * Compares conversion rate for sessions with slow API calls vs fast
 */
export async function computePerformanceImpact(siteId: string): Promise<void> {
  const db = getDb();
  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // Define slow threshold (p95 or 2 seconds)
  const slowThreshold = 2000; // 2 seconds

  // Get slow API calls
  const slowApis = await db
    .selectDistinct({ sid: sql<string>`vid` }) // Use vid as session proxy
    .from(performanceMetrics)
    .where(
      and(
        eq(performanceMetrics.siteId, siteId),
        gte(performanceMetrics.timestamp, dayAgo),
        eq(performanceMetrics.type, 'api'),
        sql`duration > ${slowThreshold}`
      )
    );

  // This is simplified - in reality we'd need to map performance metrics to sessions
  // For now, we'll compute based on sessions that had slow API calls
  const slowSessionIds = new Set(slowApis.map(r => r.sid));

  // Get conversion events
  const conversionEvents = await db
    .select({ sid: eventsRaw.sid })
    .from(eventsRaw)
    .where(
      and(
        eq(eventsRaw.siteId, siteId),
        gte(eventsRaw.ts, dayAgo),
        sql`event_name IN ('purchase', 'signup', 'conversion')`
      )
    );

  const conversionSessions = new Set(conversionEvents.map(r => r.sid));

  // Calculate rates (simplified - would need proper session mapping)
  const totalSessions = await db
    .selectDistinct({ sid: eventsRaw.sid })
    .from(eventsRaw)
    .where(
      and(
        eq(eventsRaw.siteId, siteId),
        gte(eventsRaw.ts, dayAgo)
      )
    );

  const totalSessionCount = totalSessions.length;
  const slowSessionCount = slowSessionIds.size;
  const fastSessionCount = totalSessionCount - slowSessionCount;

  let conversionRateWith = 0;
  let conversionRateWithout = 0;

  if (slowSessionCount > 0) {
    const conversionsWithSlow = Array.from(slowSessionIds).filter(sid => conversionSessions.has(sid)).length;
    conversionRateWith = (conversionsWithSlow / slowSessionCount) * 100;
  }

  if (fastSessionCount > 0) {
    const conversionsWithoutSlow = Array.from(conversionSessions).filter(sid => !slowSessionIds.has(sid)).length;
    conversionRateWithout = (conversionsWithoutSlow / fastSessionCount) * 100;
  }

  const correlationValue = conversionRateWithout - conversionRateWith;
  const affectedSessions = slowSessionCount;

  // Store or update correlation
  const existing = await db
    .select()
    .from(correlations)
    .where(
      and(
        eq(correlations.siteId, siteId),
        eq(correlations.correlationType, 'perf_impact'),
        eq(correlations.metric1, 'api_duration'),
        eq(correlations.metric2, 'conversion_rate')
      )
    )
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(correlations)
      .set({
        correlationValue: (correlationValue / 100).toString(),
        affectedSessions,
        conversionRateWith: conversionRateWith.toString(),
        conversionRateWithout: conversionRateWithout.toString(),
        computedAt: now,
      })
      .where(eq(correlations.id, existing[0].id));
  } else {
    const correlationId = nanoid();
    await db.insert(correlations).values({
      id: correlationId,
      siteId,
      correlationType: 'perf_impact',
      metric1: 'api_duration',
      metric2: 'conversion_rate',
      correlationValue: (correlationValue / 100).toString(),
      affectedSessions,
      conversionRateWith: conversionRateWith.toString(),
      conversionRateWithout: conversionRateWithout.toString(),
      computedAt: now,
    });
  }
}

/**
 * Compute frustration impact correlation
 * Compares exit/drop-off rate for sessions with rage/dead clicks vs without
 */
export async function computeFrustrationImpact(siteId: string): Promise<void> {
  const db = getDb();
  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // Get frustration events (rage clicks, dead clicks)
  const frustrationEvents = await db
    .select({ sid: eventsRaw.sid })
    .from(eventsRaw)
    .where(
      and(
        eq(eventsRaw.siteId, siteId),
        gte(eventsRaw.ts, dayAgo),
        sql`event_name IN ('rage_click', 'dead_click')`
      )
    );

  const frustrationSessionIds = new Set(frustrationEvents.map(r => r.sid));

  // Get exit events (sessions that ended)
  const allSessions = await db
    .selectDistinct({ sid: eventsRaw.sid })
    .from(eventsRaw)
    .where(
      and(
        eq(eventsRaw.siteId, siteId),
        gte(eventsRaw.ts, dayAgo)
      )
    );

  // Simplified: sessions with frustration that didn't convert are considered "exits"
  const conversionEvents = await db
    .select({ sid: eventsRaw.sid })
    .from(eventsRaw)
    .where(
      and(
        eq(eventsRaw.siteId, siteId),
        gte(eventsRaw.ts, dayAgo),
        sql`event_name IN ('purchase', 'signup', 'conversion')`
      )
    );

  const conversionSessions = new Set(conversionEvents.map(r => r.sid));

  const frustrationSessionCount = frustrationSessionIds.size;
  const noFrustrationSessionCount = allSessions.length - frustrationSessionCount;

  let exitRateWith = 0;
  let exitRateWithout = 0;

  if (frustrationSessionCount > 0) {
    const exitsWithFrustration = Array.from(frustrationSessionIds).filter(sid => !conversionSessions.has(sid)).length;
    exitRateWith = (exitsWithFrustration / frustrationSessionCount) * 100;
  }

  if (noFrustrationSessionCount > 0) {
    const exitsWithoutFrustration = Array.from(allSessions)
      .filter(r => !frustrationSessionIds.has(r.sid) && !conversionSessions.has(r.sid))
      .length;
    exitRateWithout = (exitsWithoutFrustration / noFrustrationSessionCount) * 100;
  }

  const correlationValue = exitRateWith - exitRateWithout; // Higher exit rate with frustration
  const affectedSessions = frustrationSessionCount;

  // Store or update correlation
  const existing = await db
    .select()
    .from(correlations)
    .where(
      and(
        eq(correlations.siteId, siteId),
        eq(correlations.correlationType, 'frustration_impact'),
        eq(correlations.metric1, 'frustration_events'),
        eq(correlations.metric2, 'exit_rate')
      )
    )
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(correlations)
      .set({
        correlationValue: (correlationValue / 100).toString(),
        affectedSessions,
        conversionRateWith: exitRateWith.toString(),
        conversionRateWithout: exitRateWithout.toString(),
        computedAt: now,
      })
      .where(eq(correlations.id, existing[0].id));
  } else {
    const correlationId = nanoid();
    await db.insert(correlations).values({
      id: correlationId,
      siteId,
      correlationType: 'frustration_impact',
      metric1: 'frustration_events',
      metric2: 'exit_rate',
      correlationValue: (correlationValue / 100).toString(),
      affectedSessions,
      conversionRateWith: exitRateWith.toString(),
      conversionRateWithout: exitRateWithout.toString(),
      computedAt: now,
    });
  }
}

/**
 * Compute all correlations for a site
 */
export async function computeAllCorrelations(siteId: string): Promise<void> {
  await computeErrorImpact(siteId);
  await computePerformanceImpact(siteId);
  await computeFrustrationImpact(siteId);
}
