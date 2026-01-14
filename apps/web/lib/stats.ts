/**
 * Statistical utility functions for impact analysis
 * Ported from pertento-impactmap
 */

/**
 * Calculate Wilson score interval for binomial proportion
 * Returns [lower, upper] confidence interval
 */
export function wilsonScoreInterval(
  successes: number,
  trials: number,
  confidence: number = 0.95
): [number, number] {
  if (trials === 0) return [0, 0];

  const z = confidence === 0.95 ? 1.96 : confidence === 0.99 ? 2.576 : 1.645;
  const p = successes / trials;
  const n = trials;

  const denominator = 1 + (z * z) / n;
  const center = (p + (z * z) / (2 * n)) / denominator;
  const margin =
    (z * Math.sqrt((p * (1 - p) + (z * z) / (4 * n)) / n)) / denominator;

  return [
    Math.max(0, center - margin),
    Math.min(1, center + margin),
  ];
}

/**
 * Check if two proportions are significantly different
 */
export function isSignificantDifference(
  successes1: number,
  trials1: number,
  successes2: number,
  trials2: number,
  confidence: number = 0.95
): boolean {
  if (trials1 === 0 || trials2 === 0) return false;

  const p1 = successes1 / trials1;
  const p2 = successes2 / trials2;
  const pooled = (successes1 + successes2) / (trials1 + trials2);

  const se = Math.sqrt(pooled * (1 - pooled) * (1 / trials1 + 1 / trials2));
  const z = Math.abs(p1 - p2) / se;

  const criticalZ = confidence === 0.95 ? 1.96 : confidence === 0.99 ? 2.576 : 1.645;
  return z > criticalZ;
}

/**
 * Calculate confidence interval for lift
 */
export function liftConfidenceInterval(
  elementConv: number,
  elementSessions: number,
  baselineConv: number,
  baselineSessions: number,
  confidence: number = 0.95
): [number, number] {
  if (elementSessions === 0 || baselineSessions === 0) return [0, 0];

  const p1 = elementConv / elementSessions;
  const p2 = baselineConv / baselineSessions;
  const lift = p1 - p2;

  // Calculate standard error for difference of proportions
  const se = Math.sqrt(
    (p1 * (1 - p1)) / elementSessions + (p2 * (1 - p2)) / baselineSessions
  );

  const z = confidence === 0.95 ? 1.96 : confidence === 0.99 ? 2.576 : 1.645;
  const margin = z * se;

  return [lift - margin, lift + margin];
}

/**
 * Determine if an element is causing friction
 */
export function isFrictionElement(
  elementConv: number,
  elementSessions: number,
  elementExits: number,
  baselineConv: number,
  baselineSessions: number,
  baselineExits: number,
  minSessions: number = 10
): boolean {
  if (elementSessions < minSessions) return false;

  const elementConvRate = elementConv / elementSessions;
  const elementExitRate = elementExits / elementSessions;
  const baselineConvRate = baselineConv / baselineSessions;
  const baselineExitRate = baselineExits / baselineSessions;

  // Significant negative conversion impact OR significant positive exit impact
  const hasNegativeConvImpact =
    isSignificantDifference(
      elementConv,
      elementSessions,
      baselineConv,
      baselineSessions
    ) && elementConvRate < baselineConvRate;

  const hasHighExitImpact =
    isSignificantDifference(
      elementExits,
      elementSessions,
      baselineExits,
      baselineSessions
    ) && elementExitRate > baselineExitRate;

  return hasNegativeConvImpact || hasHighExitImpact;
}

/**
 * Calculate Friction Index
 * Combines multiple factors to identify problematic elements
 */
export function calculateFrictionIndex(
  lift: number,
  exitDelta: number,
  hesitationMs?: number,
  rageClicks?: number
): number {
  // Standardize components (z-score approximation)
  const zLift = Math.max(-3, Math.min(3, -lift * 10)); // Negative lift = higher friction
  const zExit = Math.max(-3, Math.min(3, exitDelta * 5));
  const zHesitation = hesitationMs
    ? Math.max(-3, Math.min(3, (hesitationMs - 2000) / 1000))
    : 0;
  const zRage = rageClicks
    ? Math.max(-3, Math.min(3, rageClicks * 2))
    : 0;

  // Weighted sum (normalize if optional metrics missing)
  const weights =
    hesitationMs !== undefined && rageClicks !== undefined
      ? [1.0, 0.5, 0.3, 0.2]
      : hesitationMs !== undefined
      ? [1.0, 0.5, 0.3, 0]
      : rageClicks !== undefined
      ? [1.0, 0.5, 0, 0.2]
      : [1.0, 0.5, 0, 0];

  const sum =
    zLift * weights[0] +
    zExit * weights[1] +
    zHesitation * weights[2] +
    zRage * weights[3];
  const totalWeight = weights.reduce((a, b) => a + b, 0);

  return totalWeight > 0 ? sum / totalWeight : 0;
}

/**
 * Calculate device class from user agent (helper function)
 */
export function getDeviceClass(userAgent: string): string {
  if (!userAgent) return 'unknown';

  const ua = userAgent.toLowerCase();
  if (/mobile|android|iphone|ipad|tablet/.test(ua)) {
    return 'mobile';
  } else if (/tablet|ipad/.test(ua)) {
    return 'tablet';
  } else {
    return 'desktop';
  }
}

/**
 * Extract route from URL or referrer (helper function)
 */
export function extractRoute(url: string, referrer?: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.pathname;
  } catch {
    return referrer || '/';
  }
}


