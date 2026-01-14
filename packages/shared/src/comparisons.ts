/**
 * Comparison configuration for analytics reports
 */
export interface ComparisonConfig {
  type: 'segment' | 'time_period' | 'traffic_source' | 'device' | 'conversion_status' | 'custom';
  config: {
    // For segment comparison
    segmentIds?: string[];
    // For time period comparison
    previousPeriod?: boolean; // Compare to previous period
    // For traffic source comparison
    trafficSources?: string[];
    // For device comparison
    deviceCategories?: string[];
    // For conversion status
    conversionEvent?: string;
    // For custom dimension comparison
    dimension?: string;
    values?: string[];
  };
}

/**
 * Comparison result data
 */
export interface ComparisonResult {
  current: {
    value: number;
    label?: string;
  };
  previous?: {
    value: number;
    label?: string;
  };
  change: number;
  changePercent: number;
}

/**
 * Validate comparison configuration
 */
export function validateComparisonConfig(config: ComparisonConfig): { valid: boolean; error?: string } {
  if (!config.type) {
    return { valid: false, error: 'Comparison type is required' };
  }

  switch (config.type) {
    case 'segment':
      if (!config.config.segmentIds || config.config.segmentIds.length === 0) {
        return { valid: false, error: 'Segment IDs are required for segment comparison' };
      }
      break;
    case 'traffic_source':
      if (!config.config.trafficSources || config.config.trafficSources.length === 0) {
        return { valid: false, error: 'Traffic sources are required for traffic source comparison' };
      }
      break;
    case 'device':
      if (!config.config.deviceCategories || config.config.deviceCategories.length === 0) {
        return { valid: false, error: 'Device categories are required for device comparison' };
      }
      break;
    case 'conversion_status':
      if (!config.config.conversionEvent) {
        return { valid: false, error: 'Conversion event is required for conversion status comparison' };
      }
      break;
    case 'custom':
      if (!config.config.dimension || !config.config.values || config.config.values.length === 0) {
        return { valid: false, error: 'Dimension and values are required for custom comparison' };
      }
      break;
    case 'time_period':
      // No additional validation needed
      break;
    default:
      return { valid: false, error: 'Unknown comparison type' };
  }

  return { valid: true };
}


