/**
 * Anomaly detection using statistical methods
 * Detects unusual patterns beyond simple threshold-based detection
 */

import { getDb } from '@analytics/db';
import { eventsRaw, baselines } from '@analytics/db';
import { eq, and, sql, gte, lte } from 'drizzle-orm';

export interface AnomalyResult {
  isAnomaly: boolean;
  score: number; // 0-1, higher = more anomalous
  method: 'zscore' | 'iqr' | 'isolation';
  confidence: 'high' | 'medium' | 'low';
  explanation: string;
}

/**
 * Detect anomalies using Z-score method
 */
export function detectAnomalyZScore(
  value: number,
  mean: number,
  stdDev: number,
  threshold: number = 2.5
): AnomalyResult {
  if (stdDev === 0) {
    return {
      isAnomaly: false,
      score: 0,
      method: 'zscore',
      confidence: 'low',
      explanation: 'Insufficient variance for detection',
    };
  }

  const zScore = Math.abs((value - mean) / stdDev);
  const isAnomaly = zScore > threshold;
  
  let confidence: 'high' | 'medium' | 'low' = 'low';
  if (zScore > 3) confidence = 'high';
  else if (zScore > 2) confidence = 'medium';

  return {
    isAnomaly,
    score: Math.min(zScore / 5, 1.0), // Normalize to 0-1
    method: 'zscore',
    confidence,
    explanation: `Z-score: ${zScore.toFixed(2)} (${isAnomaly ? 'anomalous' : 'normal'})`,
  };
}

/**
 * Detect anomalies using Interquartile Range (IQR) method
 */
export function detectAnomalyIQR(
  value: number,
  q1: number,
  q3: number,
  multiplier: number = 1.5
): AnomalyResult {
  const iqr = q3 - q1;
  const lowerBound = q1 - multiplier * iqr;
  const upperBound = q3 + multiplier * iqr;

  const isAnomaly = value < lowerBound || value > upperBound;
  
  let score = 0;
  if (isAnomaly) {
    if (value < lowerBound) {
      score = Math.min((lowerBound - value) / iqr, 1.0);
    } else {
      score = Math.min((value - upperBound) / iqr, 1.0);
    }
  }

  let confidence: 'high' | 'medium' | 'low' = 'low';
  if (score > 0.5) confidence = 'high';
  else if (score > 0.25) confidence = 'medium';

  return {
    isAnomaly,
    score,
    method: 'iqr',
    confidence,
    explanation: `IQR bounds: [${lowerBound.toFixed(2)}, ${upperBound.toFixed(2)}], value: ${value.toFixed(2)}`,
  };
}

/**
 * Detect anomalies in a time series
 */
export async function detectTimeSeriesAnomaly(
  siteId: string,
  metricName: string,
  currentValue: number,
  timeWindow: number = 7 // days
): Promise<AnomalyResult> {
  const db = getDb();
  const now = new Date();
  const startDate = new Date(now.getTime() - timeWindow * 24 * 60 * 60 * 1000);

  // Get historical values
  const historical = await db
    .select({ value: sql<number>`count(*)` })
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

  if (historical.length < 3) {
    return {
      isAnomaly: false,
      score: 0,
      method: 'zscore',
      confidence: 'low',
      explanation: 'Insufficient historical data',
    };
  }

  const values = historical.map(h => Number(h.value));
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);

  return detectAnomalyZScore(currentValue, mean, stdDev);
}

/**
 * Detect anomalies in baseline metrics
 */
export async function detectBaselineAnomaly(
  siteId: string,
  metricName: string
): Promise<AnomalyResult | null> {
  const db = getDb();

  const baseline = await db
    .select()
    .from(baselines)
    .where(
      and(
        eq(baselines.siteId, siteId),
        eq(baselines.metricName, metricName)
      )
    )
    .limit(1);

  if (baseline.length === 0) {
    return null;
  }

  const b = baseline[0];
  const currentValue = Number(b.currentValue || 0);
  const baselineValue = Number(b.baselineValue || 0);
  const zScore = Number(b.zScore || 0);

  if (Math.abs(zScore) > 2.5) {
    return {
      isAnomaly: true,
      score: Math.min(Math.abs(zScore) / 5, 1.0),
      method: 'zscore',
      confidence: Math.abs(zScore) > 3 ? 'high' : 'medium',
      explanation: `Baseline anomaly detected: z-score ${zScore.toFixed(2)}`,
    };
  }

  return {
    isAnomaly: false,
    score: Math.min(Math.abs(zScore) / 5, 1.0),
    method: 'zscore',
    confidence: 'low',
    explanation: 'Within normal range',
  };
}
