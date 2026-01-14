/**
 * Natural Language Query Parser
 * Parses user queries like "how many visitors on /page" into structured query configs
 */

export interface ParsedQuery {
  metrics: string[];
  dimensions: string[];
  filters: Array<{
    dimension?: string;
    metric?: string;
    operator: string;
    value: string | number | boolean | string[];
  }>;
  visualization?: 'table' | 'line' | 'bar' | 'pie' | 'area';
  timeContext?: {
    type: 'relative' | 'absolute';
    value: string;
  };
  confidence: number;
  interpretation: string;
}

// Metric mappings
const METRIC_MAP: Record<string, string> = {
  'visitor': 'unique_visitors',
  'visitors': 'unique_visitors',
  'user': 'unique_visitors',
  'users': 'unique_visitors',
  'session': 'sessions',
  'sessions': 'sessions',
  'pageview': 'pageviews',
  'pageviews': 'pageviews',
  'view': 'pageviews',
  'views': 'pageviews',
  'conversion': 'events',
  'conversions': 'events',
  'revenue': 'revenue',
  'purchase': 'events',
  'purchases': 'events',
  'event': 'events',
  'events': 'events',
};

// Dimension mappings
const DIMENSION_MAP: Record<string, string> = {
  'page': 'path',
  'path': 'path',
  'url': 'path',
  'country': 'country',
  'device': 'device_category',
  'browser': 'browser_name',
  'os': 'os',
  'source': 'utm_source',
  'campaign': 'utm_campaign',
  'medium': 'utm_medium',
  'referrer': 'ref_domain',
  'event': 'event_name',
};

// Time context patterns
const TIME_PATTERNS: Array<{ pattern: RegExp; value: string }> = [
  { pattern: /\b(today|now)\b/i, value: 'today' },
  { pattern: /\byesterday\b/i, value: 'yesterday' },
  { pattern: /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i, value: 'day_of_week' },
  { pattern: /\blast\s+(week|month|year)\b/i, value: 'last_period' },
  { pattern: /\bthis\s+(week|month|year)\b/i, value: 'this_period' },
];

export function parseQuery(query: string, currentTimeRange?: { start: Date; end: Date }): ParsedQuery {
  const lowerQuery = query.toLowerCase().trim();
  const originalQuery = query.trim();
  
  // Default result
  const result: ParsedQuery = {
    metrics: [],
    dimensions: [],
    filters: [],
    visualization: 'table',
    confidence: 0,
    interpretation: '',
  };

  // Extract time context
  let timeContext: { type: 'relative' | 'absolute'; value: string } | undefined;
  for (const { pattern, value } of TIME_PATTERNS) {
    if (pattern.test(lowerQuery)) {
      const match = lowerQuery.match(pattern);
      if (match) {
        if (value === 'day_of_week') {
          timeContext = { type: 'relative', value: match[0] };
        } else {
          timeContext = { type: 'relative', value };
        }
        break;
      }
    }
  }
  
  // Special handling for common queries
  // "show me errors" or "errors"
  if (lowerQuery.includes('error') || lowerQuery.includes('bug') || lowerQuery.includes('crash')) {
    result.metrics = ['events'];
    result.filters.push({
      dimension: 'error_type',
      operator: 'is_not_null',
      value: true,
    });
    result.interpretation = 'Show errors';
    result.confidence = 0.9;
    result.timeContext = timeContext;
    return result;
  }
  
  // "conversion rate" or "conversions"
  if (lowerQuery.includes('conversion') && (lowerQuery.includes('rate') || lowerQuery.includes('percent'))) {
    result.metrics = ['conversion_rate'];
    result.interpretation = 'Conversion rate';
    result.confidence = 0.9;
    result.timeContext = timeContext;
    return result;
  }
  
  // "top pages" or "most visited pages"
  if (lowerQuery.includes('top') && (lowerQuery.includes('page') || lowerQuery.includes('url') || lowerQuery.includes('path'))) {
    result.metrics = ['pageviews'];
    result.dimensions = ['path'];
    result.visualization = 'bar';
    result.interpretation = 'Top pages by pageviews';
    result.confidence = 0.85;
    result.timeContext = timeContext;
    return result;
  }
  
  // "frustration" or "frustration signals"
  if (lowerQuery.includes('frustration') || lowerQuery.includes('rage') || lowerQuery.includes('dead click')) {
    result.metrics = ['events'];
    result.filters.push({
      dimension: 'event_name',
      operator: 'equals',
      value: 'frustration',
    });
    result.interpretation = 'Frustration signals';
    result.confidence = 0.9;
    result.timeContext = timeContext;
    return result;
  }

  // Pattern 1: "how many [metric] on [dimension]" - improved to capture full path
  const howManyPattern = /how\s+many\s+(\w+)(?:\s+on\s+(.+?))?(?:\s+in|\s+for|\s+from|\s+since|\s+this|\s+last|\s+on\s+\w+day)?$/i;
  const howManyMatch = originalQuery.match(howManyPattern);
  if (howManyMatch) {
    const metricText = howManyMatch[1]?.toLowerCase() || '';
    const dimensionValue = howManyMatch[2]?.trim();
    
    const metric = METRIC_MAP[metricText] || 'unique_visitors';
    result.metrics = [metric];
    
    if (dimensionValue) {
      // Check if it's a path (starts with / or contains /)
      if (dimensionValue.startsWith('/') || dimensionValue.includes('/')) {
        // Extract the path part (before any time-related words)
        const pathMatch = dimensionValue.match(/^([^\s]+(?:\s+[^\s]+)*?)(?:\s+(?:in|for|from|since|this|last|on|today|yesterday))?/i);
        const pathValue = pathMatch ? pathMatch[1].trim() : dimensionValue.trim();
        result.filters.push({
          dimension: 'path',
          operator: 'equals',
          value: pathValue,
        });
        result.interpretation = `Count ${metricText} for path ${pathValue}`;
      } else {
        // Try to map to a dimension
        const dimKey = DIMENSION_MAP[dimensionValue.toLowerCase()] || dimensionValue.toLowerCase();
        result.dimensions = [dimKey];
        result.interpretation = `${metricText} by ${dimensionValue}`;
      }
    } else {
      result.interpretation = `Count ${metricText}`;
    }
    
    result.confidence = 0.8;
    result.timeContext = timeContext;
    return result;
  }

  // Pattern 2: "[metric] on [path]" or "[metric] on [day]" - improved to capture full paths
  const simplePattern = /(\w+)\s+on\s+(.+?)(?:\s+(?:in|for|from|since|this|last|on\s+\w+day))?$/i;
  const simpleMatch = originalQuery.match(simplePattern);
  if (simpleMatch) {
    const metricText = simpleMatch[1]?.toLowerCase() || '';
    const value = simpleMatch[2]?.trim() || '';
    
    const metric = METRIC_MAP[metricText] || 'unique_visitors';
    result.metrics = [metric];
    
    if (value.startsWith('/') || value.includes('/')) {
      // Extract path before any time-related words
      const pathMatch = value.match(/^([^\s]+(?:\s+[^\s]+)*?)(?:\s+(?:in|for|from|since|this|last|on))?/i);
      const pathValue = pathMatch ? pathMatch[1].trim() : value.trim();
      result.filters.push({
        dimension: 'path',
        operator: 'equals',
        value: pathValue,
      });
      result.interpretation = `${metricText} on ${pathValue}`;
    } else if (TIME_PATTERNS.some(tp => tp.pattern.test(value))) {
      // It's a time reference
      result.interpretation = `${metricText} for ${value}`;
    } else {
      // Try dimension
      const dimKey = DIMENSION_MAP[value.toLowerCase()] || value.toLowerCase();
      result.dimensions = [dimKey];
      result.interpretation = `${metricText} by ${value}`;
    }
    
    result.confidence = 0.7;
    result.timeContext = timeContext;
    return result;
  }

  // Pattern 3: "[metric] who [action]" or "[metric] that [action]"
  const actionPattern = /(\w+)\s+(?:who|that)\s+(?:bought|purchased|converted|signed\s+up|clicked)\s+(?:a\s+)?(\w+)?/i;
  const actionMatch = query.match(actionPattern);
  if (actionMatch) {
    const metricText = actionMatch[1];
    const action = actionMatch[2] || 'product';
    
    const metric = METRIC_MAP[metricText] || 'unique_visitors';
    result.metrics = [metric];
    
    // Map actions to events
    if (action.includes('bought') || action.includes('purchased') || action === 'product') {
      result.filters.push({
        dimension: 'event_name',
        operator: 'equals',
        value: 'purchase',
      });
      result.interpretation = `${metricText} who purchased ${action}`;
    } else if (action.includes('signed') || action.includes('signup')) {
      result.filters.push({
        dimension: 'event_name',
        operator: 'equals',
        value: 'signup',
      });
      result.interpretation = `${metricText} who signed up`;
    } else {
      result.filters.push({
        dimension: 'event_name',
        operator: 'contains',
        value: action,
      });
      result.interpretation = `${metricText} who performed ${action}`;
    }
    
    result.confidence = 0.75;
    result.timeContext = timeContext;
    return result;
  }

  // Pattern 4: "[metric] by [dimension]"
  const byPattern = /(\w+)\s+by\s+(\w+)/i;
  const byMatch = query.match(byPattern);
  if (byMatch) {
    const metricText = byMatch[1];
    const dimensionText = byMatch[2];
    
    const metric = METRIC_MAP[metricText] || 'unique_visitors';
    const dimension = DIMENSION_MAP[dimensionText] || dimensionText;
    
    result.metrics = [metric];
    result.dimensions = [dimension];
    result.visualization = 'bar';
    result.interpretation = `${metricText} grouped by ${dimensionText}`;
    result.confidence = 0.8;
    result.timeContext = timeContext;
    return result;
  }

  // Pattern 5: Simple metric query
  const metricOnlyPattern = /^(how\s+many\s+)?(\w+)$/i;
  const metricOnlyMatch = query.match(metricOnlyPattern);
  if (metricOnlyMatch) {
    const metricText = metricOnlyMatch[2] || metricOnlyMatch[1];
    const metric = METRIC_MAP[metricText] || 'unique_visitors';
    result.metrics = [metric];
    result.interpretation = `Count ${metricText}`;
    result.confidence = 0.6;
    result.timeContext = timeContext;
    return result;
  }

  // Pattern 6: Extract path from query if it contains a path-like string
  const pathPattern = /(\/[^\s]+(?:\s+[^\s]+)*?)/i;
  const pathMatch = originalQuery.match(pathPattern);
  if (pathMatch && result.filters.length === 0) {
    const pathValue = pathMatch[1].trim();
    result.filters.push({
      dimension: 'path',
      operator: 'equals',
      value: pathValue,
    });
  }
  
  // Fallback: try to extract any known metrics or dimensions
  const words = lowerQuery.split(/\s+/);
  for (const word of words) {
    if (METRIC_MAP[word] && !result.metrics.includes(METRIC_MAP[word])) {
      result.metrics.push(METRIC_MAP[word]);
    }
    if (DIMENSION_MAP[word] && !result.dimensions.includes(DIMENSION_MAP[word])) {
      result.dimensions.push(DIMENSION_MAP[word]);
    }
  }

  if (result.metrics.length === 0) {
    result.metrics = ['unique_visitors'];
  }
  
  // If we have filters but no dimensions, don't default to path
  if (result.dimensions.length === 0 && result.filters.length === 0) {
    result.dimensions = ['path'];
  }

  result.interpretation = result.interpretation || `Query: ${originalQuery}`;
  result.confidence = result.confidence || 0.4;
  result.timeContext = timeContext;
  return result;
}

/**
 * Convert parsed query to explore query config
 */
export function parsedToQueryConfig(
  parsed: ParsedQuery,
  timeRange: { start: Date; end: Date },
  siteId: string
): any {
  // Adjust time range if time context is specified
  let adjustedTimeRange = { ...timeRange };
  if (parsed.timeContext) {
    adjustedTimeRange = adjustTimeRangeForContext(parsed.timeContext, timeRange);
  }

  // Only include dimensions if we have them and no path filter
  // If we have a path filter, we don't need path as a dimension
  const hasPathFilter = parsed.filters.some(f => f.dimension === 'path');
  const dimensions = parsed.dimensions.length > 0 
    ? parsed.dimensions 
    : (hasPathFilter ? [] : ['path']);

  return {
    timeRange: {
      start: adjustedTimeRange.start.toISOString(),
      end: adjustedTimeRange.end.toISOString(),
    },
    dimensions,
    metrics: parsed.metrics,
    filters: parsed.filters,
    visualization: parsed.visualization || 'table',
    limit: 100,
  };
}

/**
 * Adjust time range based on time context
 */
function adjustTimeRangeForContext(
  context: { type: 'relative' | 'absolute'; value: string },
  currentRange: { start: Date; end: Date }
): { start: Date; end: Date } {
  const now = new Date();
  let start = new Date(now);
  let end = new Date(now);

  switch (context.value) {
    case 'today':
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      break;
    case 'yesterday':
      start.setDate(start.getDate() - 1);
      start.setHours(0, 0, 0, 0);
      end.setDate(end.getDate() - 1);
      end.setHours(23, 59, 59, 999);
      break;
    case 'last_period': {
      // This will be handled by the query that matched it
      const queryLower = context.value.toLowerCase();
      if (queryLower.includes('week')) {
        start.setDate(start.getDate() - 7);
      } else if (queryLower.includes('month')) {
        start.setMonth(start.getMonth() - 1);
      } else if (queryLower.includes('year')) {
        start.setFullYear(start.getFullYear() - 1);
      }
      break;
    }
    default: {
      // Day of week - find the most recent occurrence
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const targetDay = dayNames.findIndex(d => context.value.toLowerCase().includes(d));
      if (targetDay !== -1) {
        const currentDay = now.getDay();
        const daysAgo = (currentDay - targetDay + 7) % 7 || 7;
        start.setDate(start.getDate() - daysAgo);
        start.setHours(0, 0, 0, 0);
        end = new Date(start);
        end.setHours(23, 59, 59, 999);
      }
      break;
    }
  }

  return { start, end };
}

