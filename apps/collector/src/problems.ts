/**
 * Problem detection and generation system
 */

import { getDb } from '@analytics/db';
import { problems, problemEvidence, errors, errorEvents, baselines, correlations, eventsRaw, performanceMetrics, formAnalytics } from '@analytics/db';
import { eq, and, sql, gte, lte, desc } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { calculateImpactScore } from './impact.js';
import { computeMetricDelta } from './delta.js';
import { calculateConversionLift, estimatePotentialImpact } from './statistics.js';
import { processProblemIntegrations } from './integrations/index.js';

export interface Problem {
  id: string;
  type: 'error_spike' | 'perf_slowdown' | 'funnel_drop' | 'ux_friction' | 'form_abandonment';
  severity: 'high' | 'medium' | 'low';
  title: string;
  description?: string;
  impactScore: number;
  affectedSessions: number;
  evidence: Record<string, any>;
  sampleSessionIds: string[];
  recommendations: string[];
}

/**
 * Detect error spike problems
 */
export async function detectErrorSpike(siteId: string): Promise<Problem[]> {
  const db = getDb();
  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const detectedProblems: Problem[] = [];

  // Get errors from last 24h
  const recentErrors = await db
    .select()
    .from(errors)
    .where(
      and(
        eq(errors.siteId, siteId),
        gte(errors.lastSeen, dayAgo)
      )
    )
    .orderBy(desc(errors.count));

  // Get baseline (average errors per day in last 7 days)
  const baselineErrors = await db
    .select({ count: sql<number>`count(*)` })
    .from(errors)
    .where(
      and(
        eq(errors.siteId, siteId),
        gte(errors.firstSeen, sevenDaysAgo),
        lte(errors.firstSeen, dayAgo)
      )
    );

  const baselineCount = Number(baselineErrors[0]?.count || 0) / 7; // Average per day
  const minimumCount = 10; // Minimum errors to trigger

  for (const error of recentErrors) {
    const currentCount = error.count;
    
    // Trigger if current > 2x baseline AND minimum count threshold
    if (currentCount > baselineCount * 2 && currentCount >= minimumCount) {
      // Get sample sessions
      const sampleSessions = await db
        .selectDistinct({ sid: errorEvents.sid })
        .from(errorEvents)
        .where(
          and(
            eq(errorEvents.errorId, error.id),
            gte(errorEvents.ts, dayAgo)
          )
        )
        .limit(10);

      const sampleSessionIds = sampleSessions.map(s => s.sid);

      // Get top paths and browsers
      const topPaths = await db
        .select({ path: errorEvents.path, count: sql<number>`count(*)` })
        .from(errorEvents)
        .where(
          and(
            eq(errorEvents.errorId, error.id),
            gte(errorEvents.ts, dayAgo)
          )
        )
        .groupBy(errorEvents.path)
        .orderBy(desc(sql`count(*)`))
        .limit(5);

      const severity: 'high' | 'medium' | 'low' = 
        currentCount > baselineCount * 5 ? 'high' :
        currentCount > baselineCount * 3 ? 'medium' : 'low';

      // Get conversion correlation if available
      const errorCorrelation = await db
        .select()
        .from(correlations)
        .where(
          and(
            eq(correlations.siteId, siteId),
            eq(correlations.correlationType, 'error_impact')
          )
        )
        .limit(1);

      let conversionLift: number | undefined;
      let conversionLiftCI: { lower: number; upper: number } | undefined;
      let conversionRateWith = 0;
      let conversionRateWithout = 0;

      if (errorCorrelation.length > 0) {
        const corr = errorCorrelation[0];
        conversionRateWith = Number(corr.conversionRateWith || 0);
        conversionRateWithout = Number(corr.conversionRateWithout || 0);
        
        if (corr.metadata && typeof corr.metadata === 'object' && 'lift' in corr.metadata) {
          const meta = corr.metadata as any;
          conversionLift = meta.lift;
          conversionLiftCI = meta.confidenceInterval;
        } else {
          // Calculate lift from rates
          conversionLift = conversionRateWithout - conversionRateWith;
        }
      }

      const impactScore = calculateImpactScore(
        currentCount,
        topPaths[0]?.path || '/',
        severity,
        'error'
      );

      detectedProblems.push({
        id: nanoid(),
        type: 'error_spike',
        severity,
        title: `Error spike: ${error.message}`,
        description: `Error count increased from ${Math.round(baselineCount)} to ${currentCount} (${Math.round((currentCount / baselineCount - 1) * 100)}% increase)`,
        impactScore,
        affectedSessions: currentCount,
        evidence: {
          count: currentCount,
          baseline: Math.round(baselineCount),
          topPaths: topPaths.map(p => ({ path: p.path, count: Number(p.count) })),
          fingerprint: error.fingerprint,
          conversionRateWith,
          conversionRateWithout,
          conversionLift,
          conversionLiftCI,
        },
        sampleSessionIds,
        recommendations: [
          'View sample sessions to understand user impact',
          'Check stack traces for root cause',
          'Review recent deployments that might have introduced this error',
        ],
      });
    }
  }

  return detectedProblems;
}

/**
 * Detect performance slowdown problems
 */
export async function detectPerformanceSlowdown(siteId: string): Promise<Problem[]> {
  const db = getDb();
  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const detectedProblems: Problem[] = [];

  // Get performance baselines
  const perfBaselines = await db
    .select()
    .from(baselines)
    .where(
      and(
        eq(baselines.siteId, siteId),
        eq(baselines.metricType, 'performance')
      )
    );

  // Check each performance metric
  for (const baseline of perfBaselines) {
    const currentValue = Number(baseline.currentValue || 0);
    const baselineValue = Number(baseline.baselineValue || 0);
    const threshold = 2000; // 2 seconds default threshold

    // Trigger if p95 > threshold OR increased by > 20%
    if (currentValue > threshold || (baselineValue > 0 && currentValue > baselineValue * 1.2)) {
      // Get affected paths
      const affectedPaths = await db
        .select({ path: performanceMetrics.name, count: sql<number>`count(*)` })
        .from(performanceMetrics)
        .where(
          and(
            eq(performanceMetrics.siteId, siteId),
            gte(performanceMetrics.timestamp, dayAgo),
            sql`duration > ${currentValue * 0.9}` // Within 10% of p95
          )
        )
        .groupBy(performanceMetrics.name)
        .orderBy(desc(sql`count(*)`))
        .limit(5);

      const severity: 'high' | 'medium' | 'low' = 
        currentValue > threshold * 2 ? 'high' :
        currentValue > threshold * 1.5 ? 'medium' : 'low';

      // Calculate affected sessions from the performance metrics
      const affectedSessionsCount = affectedPaths.reduce((sum, p) => sum + Number(p.count || 0), 0);

      const impactScore = calculateImpactScore(
        affectedSessionsCount,
        affectedPaths[0]?.path || '/',
        severity,
        baseline.metricName
      );

      detectedProblems.push({
        id: nanoid(),
        type: 'perf_slowdown',
        severity,
        title: `Performance slowdown: ${baseline.metricName}`,
        description: `p95 increased from ${Math.round(baselineValue)}ms to ${Math.round(currentValue)}ms (${Math.round(((currentValue / baselineValue - 1) * 100))}% increase)`,
        impactScore,
        affectedSessions: affectedSessionsCount,
        evidence: {
          p50: currentValue * 0.5, // Estimate
          p95: currentValue,
          baseline: baselineValue,
          affectedPaths: affectedPaths.map(p => ({ path: p.path, count: Number(p.count) })),
        },
        sampleSessionIds: [],
        recommendations: [
          'Check backend endpoint performance',
          'Review caching strategy',
          'Investigate payload size and network conditions',
        ],
      });
    }
  }

  return detectedProblems;
}

/**
 * Detect funnel conversion drop problems
 */
export async function detectFunnelDrop(siteId: string): Promise<Problem[]> {
  const db = getDb();
  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const detectedProblems: Problem[] = [];

  // Get funnel baselines (simplified - would need actual funnel definitions)
  const funnelBaselines = await db
    .select()
    .from(baselines)
    .where(
      and(
        eq(baselines.siteId, siteId),
        eq(baselines.metricType, 'funnel')
      )
    );

  for (const baseline of funnelBaselines) {
    const currentValue = Number(baseline.currentValue || 0);
    const baselineValue = Number(baseline.baselineValue || 0);

    // Trigger if conversion rate drops > 10%
    if (baselineValue > 0 && currentValue < baselineValue * 0.9) {
      const dropPercent = ((baselineValue - currentValue) / baselineValue) * 100;

      const severity: 'high' | 'medium' | 'low' = 
        dropPercent > 30 ? 'high' :
        dropPercent > 15 ? 'medium' : 'low';

      // Estimate affected sessions from baseline current value
      const affectedSessionsCount = Math.round(Number(baseline.currentValue || 0));

      const impactScore = calculateImpactScore(
        affectedSessionsCount,
        baseline.metricName,
        severity,
        baseline.metricName
      );

      detectedProblems.push({
        id: nanoid(),
        type: 'funnel_drop',
        severity,
        title: `Funnel conversion drop: ${baseline.metricName}`,
        description: `Conversion rate dropped from ${baselineValue.toFixed(2)}% to ${currentValue.toFixed(2)}% (${dropPercent.toFixed(1)}% decrease)`,
        impactScore,
        affectedSessions: affectedSessionsCount,
        evidence: {
          baselineRate: baselineValue,
          currentRate: currentValue,
          dropPercent,
          step: baseline.metricName,
        },
        sampleSessionIds: [],
        recommendations: [
          'Inspect errors on this funnel step',
          'Check performance metrics for this step',
          'Review frustration signals (rage clicks, dead clicks)',
        ],
      });
    }
  }

  return detectedProblems;
}

/**
 * Detect UX friction problems (rage/dead clicks)
 */
export async function detectUXFriction(siteId: string): Promise<Problem[]> {
  const db = getDb();
  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const detectedProblems: Problem[] = [];

  // Get rage click events
  const rageClicks = await db
    .select({ 
      selector: sql<string>`props->>'elementId'`,
      path: eventsRaw.path,
      count: sql<number>`count(*)`,
    })
    .from(eventsRaw)
    .where(
      and(
        eq(eventsRaw.siteId, siteId),
        gte(eventsRaw.ts, dayAgo),
        eq(eventsRaw.eventName, 'rage_click')
      )
    )
    .groupBy(sql`props->>'elementId'`, eventsRaw.path)
    .orderBy(desc(sql`count(*)`));

  // Get baseline (average rage clicks per day in last 7 days)
  const baselineRage = await db
    .select({ count: sql<number>`count(*)` })
    .from(eventsRaw)
    .where(
      and(
        eq(eventsRaw.siteId, siteId),
        gte(eventsRaw.ts, sevenDaysAgo),
        lte(eventsRaw.ts, dayAgo),
        eq(eventsRaw.eventName, 'rage_click')
      )
    );

  const baselineCount = Number(baselineRage[0]?.count || 0) / 7;

  for (const click of rageClicks) {
    const currentCount = Number(click.count || 0);
    
    if (currentCount > baselineCount * 2 && currentCount >= 5) {
      // Get sample sessions
      const sampleSessions = await db
        .selectDistinct({ sid: eventsRaw.sid })
        .from(eventsRaw)
        .where(
          and(
            eq(eventsRaw.siteId, siteId),
            gte(eventsRaw.ts, dayAgo),
            eq(eventsRaw.eventName, 'rage_click'),
            sql`props->>'elementId' = ${click.selector}`
          )
        )
        .limit(10);

      const sampleSessionIds = sampleSessions.map(s => s.sid);

      const severity: 'high' | 'medium' | 'low' = 
        currentCount > baselineCount * 5 ? 'high' :
        currentCount > baselineCount * 3 ? 'medium' : 'low';

      const impactScore = calculateImpactScore(
        currentCount,
        click.path || '/',
        severity,
        'rage_click'
      );

      detectedProblems.push({
        id: nanoid(),
        type: 'ux_friction',
        severity,
        title: `UX friction: Rage clicks on ${click.selector || 'element'}`,
        description: `Rage clicks increased from ${Math.round(baselineCount)} to ${currentCount} on selector ${click.selector}`,
        impactScore,
        affectedSessions: currentCount,
        evidence: {
          selector: click.selector,
          path: click.path,
          clickCount: currentCount,
          baseline: Math.round(baselineCount),
        },
        sampleSessionIds,
        recommendations: [
          'Likely missing click handler or disabled state',
          'Check if element responds slowly to user interaction',
          'Review UI/UX for this element',
        ],
      });
    }
  }

  return detectedProblems;
}

/**
 * Detect form abandonment problems
 */
export async function detectFormAbandonment(siteId: string): Promise<Problem[]> {
  const db = getDb();
  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const detectedProblems: Problem[] = [];

  // Get form abandonment events
  const abandonments = await db
    .select({
      formId: formAnalytics.formId,
      fieldName: formAnalytics.fieldName,
      count: sql<number>`count(*)`,
      avgTimeSpent: sql<number>`avg(time_spent)`,
      avgErrorCount: sql<number>`avg(error_count)`,
    })
    .from(formAnalytics)
    .where(
      and(
        eq(formAnalytics.siteId, siteId),
        gte(formAnalytics.timestamp, dayAgo),
        eq(formAnalytics.eventType, 'abandon')
      )
    )
    .groupBy(formAnalytics.formId, formAnalytics.fieldName)
    .orderBy(desc(sql`count(*)`));

  // Get baseline abandonment rate
  const baselineAbandons = await db
    .select({ count: sql<number>`count(*)` })
    .from(formAnalytics)
    .where(
      and(
        eq(formAnalytics.siteId, siteId),
        gte(formAnalytics.timestamp, sevenDaysAgo),
        lte(formAnalytics.timestamp, dayAgo),
        eq(formAnalytics.eventType, 'abandon')
      )
    );

  const baselineCount = Number(baselineAbandons[0]?.count || 0) / 7;

  // Get submit rate for comparison
  const submitCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(formAnalytics)
    .where(
      and(
        eq(formAnalytics.siteId, siteId),
        gte(formAnalytics.timestamp, dayAgo),
        eq(formAnalytics.eventType, 'submit')
      )
    );

  const currentSubmitCount = Number(submitCount[0]?.count || 0);

  for (const abandon of abandonments) {
    const currentCount = Number(abandon.count || 0);
    
    // Trigger if abandonment spikes OR submit rate drops significantly
    if (currentCount > baselineCount * 2 && currentCount >= 5) {
      // Get sample sessions
      const sampleSessions = await db
        .selectDistinct({ sid: formAnalytics.sid })
        .from(formAnalytics)
        .where(
          and(
            eq(formAnalytics.siteId, siteId),
            gte(formAnalytics.timestamp, dayAgo),
            eq(formAnalytics.eventType, 'abandon'),
            eq(formAnalytics.formId, abandon.formId),
            abandon.fieldName ? eq(formAnalytics.fieldName, abandon.fieldName) : sql`1=1`
          )
        )
        .limit(10);

      const sampleSessionIds = sampleSessions.map(s => s.sid);

      const severity: 'high' | 'medium' | 'low' = 
        currentCount > baselineCount * 5 ? 'high' :
        currentCount > baselineCount * 3 ? 'medium' : 'low';

      const impactScore = calculateImpactScore(
        currentCount,
        abandon.formId,
        severity,
        'form_abandon'
      );

      detectedProblems.push({
        id: nanoid(),
        type: 'form_abandonment',
        severity,
        title: `Form abandonment: ${abandon.formId}${abandon.fieldName ? ` - ${abandon.fieldName}` : ''}`,
        description: `Abandonment rate increased. Average time spent: ${Math.round(Number(abandon.avgTimeSpent || 0))}s, errors: ${Math.round(Number(abandon.avgErrorCount || 0))}`,
        impactScore,
        affectedSessions: currentCount,
        evidence: {
          formId: abandon.formId,
          fieldName: abandon.fieldName,
          abandonCount: currentCount,
          baseline: Math.round(baselineCount),
          avgTimeSpent: Number(abandon.avgTimeSpent || 0),
          avgErrorCount: Number(abandon.avgErrorCount || 0),
          submitRate: currentSubmitCount,
        },
        sampleSessionIds,
        recommendations: [
          'Review validation messaging',
          'Check input constraints and requirements',
          'Investigate error patterns on this field',
        ],
      });
    }
  }

  return detectedProblems;
}

/**
 * Detect all problems for a site
 */
export async function detectAllProblems(siteId: string): Promise<void> {
  const db = getDb();

  // Run all detectors
  const errorProblems = await detectErrorSpike(siteId);
  const perfProblems = await detectPerformanceSlowdown(siteId);
  const funnelProblems = await detectFunnelDrop(siteId);
  const uxProblems = await detectUXFriction(siteId);
  const formProblems = await detectFormAbandonment(siteId);

  const allProblems = [
    ...errorProblems,
    ...perfProblems,
    ...funnelProblems,
    ...uxProblems,
    ...formProblems,
  ];

  // Store problems in database
  for (const problem of allProblems) {
    // Check if problem already exists (by type and key evidence)
    const existing = await db
      .select()
      .from(problems)
      .where(
        and(
          eq(problems.siteId, siteId),
          eq(problems.type, problem.type),
          eq(problems.status, 'active')
        )
      )
      .limit(1);

    if (existing.length > 0) {
      // Update existing problem
      await db
        .update(problems)
        .set({
          impactScore: problem.impactScore.toString(),
          affectedSessions: problem.affectedSessions,
          lastSeen: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(problems.id, existing[0].id));

      // Update evidence
      await db
        .update(problemEvidence)
        .set({
          evidenceData: problem.evidence,
          sampleSessionIds: problem.sampleSessionIds,
        })
        .where(eq(problemEvidence.problemId, existing[0].id));
    } else {
      // Create new problem
      const problemId = problem.id;
      await db.insert(problems).values({
        id: problemId,
        siteId,
        type: problem.type,
        severity: problem.severity,
        title: problem.title,
        description: problem.description,
        impactScore: problem.impactScore.toString(),
        affectedSessions: problem.affectedSessions,
        status: 'active',
        firstSeen: new Date(),
        lastSeen: new Date(),
        metadata: problem.evidence,
      });

      // Store evidence with conversion lift metadata
      const evidenceData = {
        ...problem.evidence,
        conversionLift: problem.evidence.conversionLift,
        conversionLiftCI: problem.evidence.conversionLiftCI,
      };

      await db.insert(problemEvidence).values({
        id: nanoid(),
        problemId,
        siteId,
        evidenceType: 'count',
        evidenceData,
        sampleSessionIds: problem.sampleSessionIds,
      });

      // Also store conversion lift in problem metadata for easy access
      if (problem.evidence.conversionLift !== undefined) {
        await db
          .update(problems)
          .set({
            metadata: {
              ...problem.evidence,
              conversionLift: problem.evidence.conversionLift,
              conversionLiftCI: problem.evidence.conversionLiftCI,
            },
          })
          .where(eq(problems.id, problemId));
      }

      // Trigger integrations for high-severity problems
      if (problem.severity === 'high') {
        try {
          await processProblemIntegrations(siteId, problemId);
        } catch (error) {
          console.error(`Failed to process integrations for problem ${problemId}:`, error);
        }
      }
    }
  }
}
