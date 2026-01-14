/**
 * Statistical utilities for conversion lift and confidence intervals
 */

/**
 * Calculate Wilson score confidence interval for a proportion
 * This works even with zero conversions
 */
export function wilsonScoreInterval(
  successes: number,
  trials: number,
  confidence: number = 0.95
): { lower: number; upper: number; center: number } {
  if (trials === 0) {
    return { lower: 0, upper: 0, center: 0 };
  }

  const z = confidence === 0.95 ? 1.96 : confidence === 0.99 ? 2.576 : 1.96;
  const p = successes / trials;
  const denominator = 1 + (z * z) / trials;
  const center = (p + (z * z) / (2 * trials)) / denominator;
  const margin = (z / denominator) * Math.sqrt((p * (1 - p) + (z * z) / (4 * trials)) / trials);

  return {
    lower: Math.max(0, center - margin),
    upper: Math.min(1, center + margin),
    center,
  };
}

/**
 * Calculate conversion lift between two groups
 * Returns lift in percentage points (pp) with confidence interval
 */
export function calculateConversionLift(
  conversionsA: number,
  sessionsA: number,
  conversionsB: number,
  sessionsB: number,
  confidence: number = 0.95
): {
  lift: number; // in percentage points
  liftPercent: number; // percentage change
  confidenceInterval: { lower: number; upper: number };
  significant: boolean;
  rateA: number; // percentage
  rateB: number; // percentage
  rateAInterval: { lower: number; upper: number };
  rateBInterval: { lower: number; upper: number };
} {
  // Calculate rates as percentages
  const rateA = sessionsA > 0 ? (conversionsA / sessionsA) * 100 : 0;
  const rateB = sessionsB > 0 ? (conversionsB / sessionsB) * 100 : 0;

  // Calculate confidence intervals for each rate
  const intervalA = wilsonScoreInterval(conversionsA, sessionsA, confidence);
  const intervalB = wilsonScoreInterval(conversionsB, sessionsB, confidence);

  // Convert intervals to percentage points
  const rateAInterval = {
    lower: intervalA.lower * 100,
    upper: intervalA.upper * 100,
  };
  const rateBInterval = {
    lower: intervalB.lower * 100,
    upper: intervalB.upper * 100,
  };

  // Calculate lift (B - A) in percentage points
  const lift = rateB - rateA;

  // Calculate percentage change
  const liftPercent = rateA > 0 ? ((rateB - rateA) / rateA) * 100 : (rateB > 0 ? Infinity : 0);

  // Calculate confidence interval for the difference
  // Using normal approximation for difference of proportions
  const seA = Math.sqrt((intervalA.center * (1 - intervalA.center)) / sessionsA);
  const seB = Math.sqrt((intervalB.center * (1 - intervalB.center)) / sessionsB);
  const seDiff = Math.sqrt(seA * seA + seB * seB);
  
  const z = confidence === 0.95 ? 1.96 : confidence === 0.99 ? 2.576 : 1.96;
  const margin = z * seDiff * 100; // Convert to percentage points

  const confidenceInterval = {
    lower: lift - margin,
    upper: lift + margin,
  };

  // Determine significance: intervals don't overlap OR lift CI doesn't include 0
  const significant = 
    intervalA.upper < intervalB.lower || 
    intervalB.upper < intervalA.lower ||
    (confidenceInterval.lower > 0 && confidenceInterval.upper > 0) ||
    (confidenceInterval.lower < 0 && confidenceInterval.upper < 0);

  return {
    lift,
    liftPercent,
    confidenceInterval,
    significant,
    rateA,
    rateB,
    rateAInterval,
    rateBInterval,
  };
}

/**
 * Format conversion lift for display
 */
export function formatConversionLift(lift: number, ci: { lower: number; upper: number }): string {
  const sign = lift >= 0 ? '+' : '';
  const liftFormatted = `${sign}${lift.toFixed(1)}pp`;
  const ciFormatted = `[${ci.lower.toFixed(1)}, ${ci.upper.toFixed(1)}]pp`;
  return `${liftFormatted}\nCI: ${ciFormatted}`;
}

/**
 * Calculate potential impact even with zero conversions
 * Uses statistical estimation to show potential conversion lift
 */
export function estimatePotentialImpact(
  affectedSessions: number,
  baselineConversionRate: number, // as percentage
  estimatedLift: number // in percentage points
): {
  potentialConversions: number;
  potentialRevenue: number; // if average order value provided
  confidence: 'high' | 'medium' | 'low';
} {
  // Estimate potential conversions if issue is fixed
  const potentialRate = baselineConversionRate + estimatedLift;
  const potentialConversions = (affectedSessions * potentialRate) / 100;

  // Determine confidence based on sample size
  let confidence: 'high' | 'medium' | 'low' = 'low';
  if (affectedSessions >= 1000) {
    confidence = 'high';
  } else if (affectedSessions >= 100) {
    confidence = 'medium';
  }

  return {
    potentialConversions,
    potentialRevenue: 0, // Will be calculated separately if AOV is known
    confidence,
  };
}

/**
 * Two-proportion z-test for significance
 */
export function twoProportionZTest(
  conversionsA: number,
  sessionsA: number,
  conversionsB: number,
  sessionsB: number
): {
  z: number;
  pValue: number;
  significant: boolean;
} {
  if (sessionsA === 0 || sessionsB === 0) {
    return { z: 0, pValue: 1, significant: false };
  }

  const p1 = conversionsA / sessionsA;
  const p2 = conversionsB / sessionsB;
  const pPooled = (conversionsA + conversionsB) / (sessionsA + sessionsB);

  if (pPooled === 0 || pPooled === 1) {
    return { z: 0, pValue: 1, significant: false };
  }

  const se = Math.sqrt(pPooled * (1 - pPooled) * (1 / sessionsA + 1 / sessionsB));
  if (se === 0) {
    return { z: 0, pValue: 1, significant: false };
  }

  const z = (p1 - p2) / se;
  // Approximate p-value from z-score (two-tailed)
  const pValue = 2 * (1 - normalCDF(Math.abs(z)));

  return {
    z,
    pValue,
    significant: pValue < 0.05,
  };
}

/**
 * Normal CDF approximation
 */
function normalCDF(z: number): number {
  // Approximation using error function
  return 0.5 * (1 + erf(z / Math.sqrt(2)));
}

/**
 * Error function approximation
 */
function erf(x: number): number {
  // Abramowitz and Stegun approximation
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x);

  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

  return sign * y;
}
