/**
 * Forecasting utilities for predictive analytics
 * Predicts future trends and potential problems
 */

import { getDb } from '@analytics/db';
import { baselines, eventsRaw, problems } from '@analytics/db';
import { eq, and, sql, gte, lte } from 'drizzle-orm';

export interface Forecast {
  metricName: string;
  currentValue: number;
  predictedValue: number;
  predictedDate: Date;
  trend: 'increasing' | 'decreasing' | 'stable';
  confidence: 'high' | 'medium' | 'low';
  predictedSeverity?: 'high' | 'medium' | 'low';
  predictedTimeline?: string; // e.g., "3 days"
}

/**
 * Simple linear regression for trend prediction
 */
function linearRegression(x: number[], y: number[]): { slope: number; intercept: number; r2: number } {
  const n = x.length;
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
  const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
  const sumY2 = y.reduce((sum, yi) => sum + yi * yi, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  // Calculate R²
  const yMean = sumY / n;
  const ssRes = y.reduce((sum, yi, i) => {
    const predicted = slope * x[i] + intercept;
    return sum + Math.pow(yi - predicted, 2);
  }, 0);
  const ssTot = y.reduce((sum, yi) => sum + Math.pow(yi - yMean, 2), 0);
  const r2 = 1 - (ssRes / ssTot);

  return { slope, intercept, r2 };
}

/**
 * Forecast metric trend
 */
export async function forecastMetric(
  siteId: string,
  metricName: string,
  daysAhead: number = 3
): Promise<Forecast | null> {
  const db = getDb();
  const now = new Date();
  const startDate = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000); // 14 days of history

  // Get historical daily values
  const historical = await db
    .select({ 
      date: sql<string>`DATE(ts)`,
      value: sql<number>`count(*)`,
    })
    .from(eventsRaw)
    .where(
      and(
        eq(eventsRaw.siteId, siteId),
        gte(eventsRaw.ts, startDate),
        lte(eventsRaw.ts, now),
        eq(eventsRaw.eventName, metricName)
      )
    )
    .groupBy(sql`DATE(ts)`)
    .orderBy(sql`DATE(ts)`);

  if (historical.length < 7) {
    return null; // Need at least 7 days of data
  }

  // Prepare data for regression
  const x = historical.map((_, i) => i);
  const y = historical.map(h => Number(h.value));

  const regression = linearRegression(x, y);
  
  // Get current value
  const currentValue = y[y.length - 1];
  
  // Predict future value
  const futureX = x.length + daysAhead - 1;
  const predictedValue = regression.slope * futureX + regression.intercept;

  // Determine trend
  let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
  if (regression.slope > 0.1) trend = 'increasing';
  else if (regression.slope < -0.1) trend = 'decreasing';

  // Determine confidence based on R²
  let confidence: 'high' | 'medium' | 'low' = 'low';
  if (regression.r2 > 0.7) confidence = 'high';
  else if (regression.r2 > 0.4) confidence = 'medium';

  // Predict severity if trend is concerning
  let predictedSeverity: 'high' | 'medium' | 'low' | undefined;
  let predictedTimeline: string | undefined;

  if (trend === 'increasing' && metricName.includes('error')) {
    // Error rate increasing - predict when it becomes critical
    const threshold = currentValue * 2; // 2x current is critical
    if (predictedValue >= threshold) {
      predictedSeverity = 'high';
      predictedTimeline = `${daysAhead} days`;
    }
  }

  const predictedDate = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);

  return {
    metricName,
    currentValue,
    predictedValue: Math.max(0, predictedValue), // Can't be negative
    predictedDate,
    trend,
    confidence,
    predictedSeverity,
    predictedTimeline,
  };
}

/**
 * Forecast problem severity
 */
export async function forecastProblemSeverity(
  siteId: string,
  problemId: string
): Promise<{ predictedSeverity: 'high' | 'medium' | 'low'; predictedTimeline: string } | null> {
  const db = getDb();

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
    return null;
  }

  const p = problem[0];
  const affectedSessions = p.affectedSessions;
  const firstSeen = new Date(p.firstSeen);
  const lastSeen = new Date(p.lastSeen);
  const daysSinceFirstSeen = (Date.now() - firstSeen.getTime()) / (24 * 60 * 60 * 1000);

  // Calculate growth rate
  const growthRate = (affectedSessions / Math.max(daysSinceFirstSeen, 1));

  // Predict when it becomes critical (e.g., 10x current)
  const criticalThreshold = affectedSessions * 10;
  const daysToCritical = (criticalThreshold - affectedSessions) / growthRate;

  let predictedSeverity: 'high' | 'medium' | 'low' = 'low';
  let predictedTimeline: string;

  if (daysToCritical <= 1) {
    predictedSeverity = 'high';
    predictedTimeline = 'within 1 day';
  } else if (daysToCritical <= 3) {
    predictedSeverity = 'high';
    predictedTimeline = 'within 3 days';
  } else if (daysToCritical <= 7) {
    predictedSeverity = 'medium';
    predictedTimeline = 'within 7 days';
  } else {
    predictedSeverity = 'low';
    predictedTimeline = 'beyond 7 days';
  }

  // Update problem with prediction
  await db
    .update(problems)
    .set({
      predictedSeverity: predictedSeverity,
      predictedTimeline: predictedTimeline,
    })
    .where(eq(problems.id, problemId));

  return {
    predictedSeverity,
    predictedTimeline,
  };
}
