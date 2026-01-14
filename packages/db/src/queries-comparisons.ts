import { getPool, getDb } from './client';
import { segments } from './schema';
import { eq, and } from 'drizzle-orm';
import { TimeRange } from './queries';
import { ComparisonConfig, ComparisonResult } from '@analytics/shared';
import { FilterConfig } from '@analytics/shared';
import { applyFilters } from '@analytics/shared';

/**
 * Convert segment conditions to FilterConfig array
 */
function segmentConditionsToFilters(conditions: any[]): FilterConfig[] {
  const filters: FilterConfig[] = [];
  
  for (let i = 0; i < conditions.length; i++) {
    const condition = conditions[i];
    const filter: FilterConfig = {
      dimension: condition.dimension,
      operator: condition.operator,
      value: condition.value,
    };
    
    // Add logic operator if not the first condition
    if (i > 0 && condition.logic) {
      filter.logic = condition.logic;
    }
    
    filters.push(filter);
  }
  
  return filters;
}

/**
 * Compare metrics across segments
 */
export async function compareSegments(
  siteId: string,
  timeRange: TimeRange,
  segmentIds: string[],
  metricFn: (siteId: string, timeRange: TimeRange, filters: FilterConfig[]) => Promise<any>
): Promise<Record<string, ComparisonResult>> {
  const results: Record<string, ComparisonResult> = {};
  const db = getDb();

  // Get base metric (all data)
  const baseResult = await metricFn(siteId, timeRange, []);
  const baseValue = extractMetricValue(baseResult);

  // Load all segments from database
  const segmentsList = await db
    .select()
    .from(segments)
    .where(and(
      eq(segments.siteId, siteId),
      eq(segments.enabled, true)
    ));

  // Create a map for quick lookup
  const segmentsMap = new Map(segmentsList.map(s => [s.id, s]));

  // Get metrics for each segment
  for (const segmentId of segmentIds) {
    const segment = segmentsMap.get(segmentId);
    
    if (!segment) {
      // Segment not found, skip it
      continue;
    }

    // Convert segment conditions to filters
    const filters = segmentConditionsToFilters(segment.conditions || []);
    
    // Get metric with segment filters applied
    const segmentResult = await metricFn(siteId, timeRange, filters);
    const segmentValue = extractMetricValue(segmentResult);

    results[segmentId] = {
      current: { value: segmentValue, label: segment.name },
      previous: { value: baseValue },
      change: segmentValue - baseValue,
      changePercent: baseValue > 0 ? ((segmentValue - baseValue) / baseValue) * 100 : 0,
    };
  }

  return results;
}

/**
 * Compare current vs previous time period
 */
export async function compareTimePeriods(
  siteId: string,
  currentRange: TimeRange,
  metricFn: (siteId: string, timeRange: TimeRange, filters: FilterConfig[]) => Promise<any>
): Promise<ComparisonResult> {
  // Calculate previous period
  const duration = currentRange.end.getTime() - currentRange.start.getTime();
  const previousEnd = new Date(currentRange.start.getTime() - 1);
  const previousStart = new Date(previousEnd.getTime() - duration);
  const previousRange: TimeRange = { start: previousStart, end: previousEnd };

  // Get metrics for both periods
  const [currentResult, previousResult] = await Promise.all([
    metricFn(siteId, currentRange, []),
    metricFn(siteId, previousRange, []),
  ]);

  const currentValue = extractMetricValue(currentResult);
  const previousValue = extractMetricValue(previousResult);

  return {
    current: { value: currentValue },
    previous: { value: previousValue },
    change: currentValue - previousValue,
    changePercent: previousValue > 0 ? ((currentValue - previousValue) / previousValue) * 100 : 0,
  };
}

/**
 * Compare metrics by traffic source
 */
export async function compareTrafficSources(
  siteId: string,
  timeRange: TimeRange,
  trafficSources: string[],
  metricFn: (siteId: string, timeRange: TimeRange, filters: FilterConfig[]) => Promise<any>
): Promise<Record<string, ComparisonResult>> {
  const results: Record<string, ComparisonResult> = {};
  const pool = getPool();

  // Get base metric (all traffic sources)
  const baseResult = await metricFn(siteId, timeRange, []);
  const baseValue = extractMetricValue(baseResult);

  // Get metrics for each traffic source
  for (const source of trafficSources) {
    const filters: FilterConfig[] = [
      {
        dimension: 'ref_domain',
        operator: source === 'direct' ? 'equals' : 'contains',
        value: source === 'direct' ? '' : source,
      },
    ];

    const sourceResult = await metricFn(siteId, timeRange, filters);
    const sourceValue = extractMetricValue(sourceResult);

    results[source] = {
      current: { value: sourceValue, label: source },
      previous: { value: baseValue },
      change: sourceValue - baseValue,
      changePercent: baseValue > 0 ? ((sourceValue - baseValue) / baseValue) * 100 : 0,
    };
  }

  return results;
}

/**
 * Compare metrics by device category
 */
export async function compareDevices(
  siteId: string,
  timeRange: TimeRange,
  deviceCategories: string[],
  metricFn: (siteId: string, timeRange: TimeRange, filters: FilterConfig[]) => Promise<any>
): Promise<Record<string, ComparisonResult>> {
  const results: Record<string, ComparisonResult> = {};

  // Get base metric (all devices)
  const baseResult = await metricFn(siteId, timeRange, []);
  const baseValue = extractMetricValue(baseResult);

  // Get metrics for each device category
  for (const device of deviceCategories) {
    const filters: FilterConfig[] = [
      {
        dimension: 'device_category',
        operator: 'equals',
        value: device,
      },
    ];

    const deviceResult = await metricFn(siteId, timeRange, filters);
    const deviceValue = extractMetricValue(deviceResult);

    results[device] = {
      current: { value: deviceValue, label: device },
      previous: { value: baseValue },
      change: deviceValue - baseValue,
      changePercent: baseValue > 0 ? ((deviceValue - baseValue) / baseValue) * 100 : 0,
    };
  }

  return results;
}

/**
 * Compare converting vs non-converting users
 */
export async function compareConversionStatus(
  siteId: string,
  timeRange: TimeRange,
  conversionEvent: string,
  metricFn: (siteId: string, timeRange: TimeRange, filters: FilterConfig[]) => Promise<any>
): Promise<{ converting: ComparisonResult; nonConverting: ComparisonResult }> {
  const pool = getPool();

  // Get users who converted
  const convertingSidsResult = await pool.query(`
    SELECT DISTINCT sid
    FROM events_raw
    WHERE site_id = $1
      AND ts >= $2
      AND ts <= $3
      AND event_type = 'event'
      AND event_name = $4
  `, [siteId, timeRange.start, timeRange.end, conversionEvent]);

  const convertingSids = convertingSidsResult.rows.map((r: any) => r.sid);

  // Get base metric (all users)
  const baseResult = await metricFn(siteId, timeRange, []);
  const baseValue = extractMetricValue(baseResult);

  // For converting users, we'd need to filter by session IDs
  // This is a simplified version - in practice, you'd need more complex filtering
  const convertingResult = await metricFn(siteId, timeRange, []);
  const convertingValue = extractMetricValue(convertingResult);

  // Non-converting would be base - converting (approximation)
  const nonConvertingValue = baseValue - convertingValue;

  return {
    converting: {
      current: { value: convertingValue, label: 'Converting' },
      previous: { value: baseValue },
      change: convertingValue - baseValue,
      changePercent: baseValue > 0 ? ((convertingValue - baseValue) / baseValue) * 100 : 0,
    },
    nonConverting: {
      current: { value: nonConvertingValue, label: 'Non-Converting' },
      previous: { value: baseValue },
      change: nonConvertingValue - baseValue,
      changePercent: baseValue > 0 ? ((nonConvertingValue - baseValue) / baseValue) * 100 : 0,
    },
  };
}

/**
 * Generic comparison function
 */
export async function getComparisonData(
  siteId: string,
  timeRange: TimeRange,
  comparisonConfig: ComparisonConfig,
  metricFn: (siteId: string, timeRange: TimeRange, filters: FilterConfig[]) => Promise<any>
): Promise<ComparisonResult | Record<string, ComparisonResult>> {
  switch (comparisonConfig.type) {
    case 'time_period':
      return compareTimePeriods(siteId, timeRange, metricFn);
    case 'segment':
      if (!comparisonConfig.config.segmentIds) {
        throw new Error('Segment IDs required for segment comparison');
      }
      return compareSegments(siteId, timeRange, comparisonConfig.config.segmentIds, metricFn);
    case 'traffic_source':
      if (!comparisonConfig.config.trafficSources) {
        throw new Error('Traffic sources required for traffic source comparison');
      }
      return compareTrafficSources(siteId, timeRange, comparisonConfig.config.trafficSources, metricFn);
    case 'device':
      if (!comparisonConfig.config.deviceCategories) {
        throw new Error('Device categories required for device comparison');
      }
      return compareDevices(siteId, timeRange, comparisonConfig.config.deviceCategories, metricFn);
    case 'conversion_status':
      if (!comparisonConfig.config.conversionEvent) {
        throw new Error('Conversion event required for conversion status comparison');
      }
      return compareConversionStatus(siteId, timeRange, comparisonConfig.config.conversionEvent, metricFn);
    default:
      throw new Error(`Unsupported comparison type: ${comparisonConfig.type}`);
  }
}

/**
 * Extract metric value from query result
 * This is a helper to extract the primary metric value from various result types
 */
function extractMetricValue(result: any): number {
  if (typeof result === 'number') {
    return result;
  }
  if (result && typeof result === 'object') {
    // Try common metric fields
    if ('uniqueVisitors' in result) return result.uniqueVisitors;
    if ('uniqueSessions' in result) return result.uniqueSessions;
    if ('totalSessions' in result) return result.totalSessions;
    if ('totalEvents' in result) return result.totalEvents;
    if ('revenue' in result) return result.revenue;
    if ('count' in result) return result.count;
    if ('value' in result) return result.value;
    // If it's an array, sum it up
    if (Array.isArray(result)) {
      return result.reduce((sum, item) => sum + extractMetricValue(item), 0);
    }
  }
  return 0;
}

