/**
 * Business impact translation utilities
 * Translates technical metrics to business metrics (revenue, cost, ROI)
 */

import { getDb } from '@analytics/db';
import { problems, eventsRaw, ecommerceItems } from '@analytics/db';
import { eq, and, sql, gte, lte } from 'drizzle-orm';

export interface BusinessImpactConfig {
  averageOrderValue?: number; // Average order value in dollars
  conversionValue?: Record<string, number>; // Value per conversion type (e.g., { 'signup': 50, 'purchase': 100 })
  costPerFix?: Record<string, number>; // Estimated cost to fix by problem type
}

export interface BusinessImpactResult {
  revenueImpact: number; // Estimated revenue loss
  affectedRevenue: number; // Actual affected revenue (if conversions exist)
  potentialRevenue: number; // Potential revenue if issue is fixed
  costToFix: number; // Estimated cost to fix
  roi: number; // Return on investment (potentialRevenue / costToFix)
  affectedCustomers: number; // Number of customers affected
}

/**
 * Calculate business impact for a problem
 */
export async function calculateBusinessImpact(
  siteId: string,
  problemId: string,
  config: BusinessImpactConfig
): Promise<BusinessImpactResult> {
  const db = getDb();
  
  // Get problem details
  const problem = await db
    .select()
    .from(problems)
    .where(
      and(
        eq(problems.id, problemId),
        eq(problems.siteId, siteId)
      )
    )
    .limit(1);

  if (problem.length === 0) {
    throw new Error('Problem not found');
  }

  const p = problem[0];
  const affectedSessions = p.affectedSessions;
  const problemType = p.type;

  // Get conversion lift from metadata or evidence
  const conversionLift = p.metadata?.conversionLift || 0; // in percentage points
  const conversionRateWith = Number(p.metadata?.conversionRateWith || 0);
  const conversionRateWithout = Number(p.metadata?.conversionRateWithout || 0);

  // Calculate affected revenue (actual lost conversions)
  let affectedRevenue = 0;
  if (conversionRateWith < conversionRateWithout) {
    const lostConversions = (affectedSessions * (conversionRateWithout - conversionRateWith)) / 100;
    const avgOrderValue = config.averageOrderValue || 100; // Default AOV
    affectedRevenue = lostConversions * avgOrderValue;
  }

  // Calculate potential revenue if issue is fixed
  const potentialRate = conversionRateWith + conversionLift;
  const potentialConversions = (affectedSessions * potentialRate) / 100;
  const avgOrderValue = config.averageOrderValue || 100;
  const potentialRevenue = potentialConversions * avgOrderValue;

  // Estimate revenue impact (conservative estimate)
  const revenueImpact = affectedRevenue || (affectedSessions * conversionLift * avgOrderValue) / 100;

  // Estimate cost to fix
  const costToFix = config.costPerFix?.[problemType] || getDefaultCostToFix(problemType);

  // Calculate ROI
  const roi = costToFix > 0 ? (potentialRevenue - affectedRevenue) / costToFix : 0;

  // Estimate affected customers (sessions with unique visitors)
  const affectedCustomers = Math.min(affectedSessions, affectedSessions * 0.8); // Assume 80% unique visitors

  return {
    revenueImpact,
    affectedRevenue,
    potentialRevenue,
    costToFix,
    roi,
    affectedCustomers: Math.round(affectedCustomers),
  };
}

/**
 * Get default cost to fix by problem type
 */
function getDefaultCostToFix(problemType: string): number {
  const defaults: Record<string, number> = {
    error_spike: 2000, // 2 hours @ $1000/hr
    perf_slowdown: 4000, // 4 hours @ $1000/hr
    funnel_drop: 3000, // 3 hours @ $1000/hr
    ux_friction: 1500, // 1.5 hours @ $1000/hr
    form_abandonment: 1000, // 1 hour @ $1000/hr
  };
  return defaults[problemType] || 2000;
}

/**
 * Calculate actual revenue from e-commerce data
 */
export async function calculateActualRevenue(
  siteId: string,
  startDate: Date,
  endDate: Date
): Promise<number> {
  const db = getDb();

  // Get revenue from e-commerce items
  const revenue = await db
    .select({ total: sql<number>`sum(revenue)` })
    .from(ecommerceItems)
    .innerJoin(eventsRaw, eq(ecommerceItems.eventId, eventsRaw.id))
    .where(
      and(
        eq(eventsRaw.siteId, siteId),
        gte(eventsRaw.ts, startDate),
        lte(eventsRaw.ts, endDate)
      )
    );

  return Number(revenue[0]?.total || 0);
}

/**
 * Update problem with business impact metrics
 */
export async function updateProblemBusinessImpact(
  siteId: string,
  problemId: string,
  config: BusinessImpactConfig
): Promise<void> {
  const db = getDb();

  const impact = await calculateBusinessImpact(siteId, problemId, config);

  await db
    .update(problems)
    .set({
      revenueImpact: impact.revenueImpact.toString(),
      affectedRevenue: impact.affectedRevenue.toString(),
      costToFix: impact.costToFix.toString(),
      metadata: sql`COALESCE(metadata, '{}'::jsonb) || ${JSON.stringify({
        ...impact,
        calculatedAt: new Date().toISOString(),
      })}::jsonb`,
    })
    .where(
      and(
        eq(problems.id, problemId),
        eq(problems.siteId, siteId)
      )
    );
}

/**
 * Calculate business impact for all active problems
 */
export async function calculateAllBusinessImpacts(
  siteId: string,
  config: BusinessImpactConfig
): Promise<void> {
  const db = getDb();

  const activeProblems = await db
    .select()
    .from(problems)
    .where(
      and(
        eq(problems.siteId, siteId),
        eq(problems.status, 'active')
      )
    );

  for (const problem of activeProblems) {
    try {
      await updateProblemBusinessImpact(siteId, problem.id, config);
    } catch (error) {
      console.error(`Failed to calculate business impact for problem ${problem.id}:`, error);
    }
  }
}
