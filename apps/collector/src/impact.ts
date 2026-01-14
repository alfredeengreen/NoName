/**
 * Impact scoring utilities
 */

export interface ImpactScoreConfig {
  funnelWeight?: {
    checkout?: number;
    conversion?: number;
    pricing?: number;
    signup?: number;
    other?: number;
  };
  severityMultiplier?: {
    high?: number;
    medium?: number;
    low?: number;
  };
}

export const DEFAULT_IMPACT_CONFIG: Required<ImpactScoreConfig> = {
  funnelWeight: {
    checkout: 3.0,
    conversion: 3.0,
    pricing: 2.0,
    signup: 2.0,
    other: 1.0,
  },
  severityMultiplier: {
    high: 3.0,
    medium: 1.5,
    low: 1.0,
  },
};

/**
 * Determine funnel weight based on path or event name
 */
export function getFunnelWeight(path: string, eventName?: string, config?: ImpactScoreConfig): number {
  const weights = config?.funnelWeight || DEFAULT_IMPACT_CONFIG.funnelWeight;
  const pathLower = path.toLowerCase();
  const eventLower = eventName?.toLowerCase() || '';

  // Check for checkout/conversion paths
  if (pathLower.includes('checkout') || pathLower.includes('purchase') || 
      eventLower.includes('purchase') || eventLower.includes('checkout')) {
    return weights.checkout || weights.conversion || 3.0;
  }

  // Check for pricing/signup paths
  if (pathLower.includes('pricing') || pathLower.includes('signup') || 
      eventLower.includes('signup')) {
    return weights.pricing || weights.signup || 2.0;
  }

  return weights.other || 1.0;
}

/**
 * Get severity multiplier
 */
export function getSeverityMultiplier(severity: 'high' | 'medium' | 'low', config?: ImpactScoreConfig): number {
  const multipliers = config?.severityMultiplier || DEFAULT_IMPACT_CONFIG.severityMultiplier;
  return multipliers[severity] || 1.0;
}

/**
 * Calculate impact score
 * Formula: affected_sessions × funnel_weight × severity_multiplier
 */
export function calculateImpactScore(
  affectedSessions: number,
  path: string,
  severity: 'high' | 'medium' | 'low',
  eventName?: string,
  config?: ImpactScoreConfig
): number {
  const funnelWeight = getFunnelWeight(path, eventName, config);
  const severityMultiplier = getSeverityMultiplier(severity, config);
  
  return affectedSessions * funnelWeight * severityMultiplier;
}
