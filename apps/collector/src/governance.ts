import { getDb } from '@analytics/db';
import { dimCardinality, siteConfig } from '@analytics/db';
import { eq, and, sql } from 'drizzle-orm';
import { createHash } from 'node:crypto';

export interface CardinalityLimits {
  maxDistinctEventKeysPerDay: number;
  maxDistinctPathsPerDay: number;
  maxDistinctDimensionValuesPerKeyPerDay: number;
  maxDistinctPerfNamesPerDay: number;
  maxDistinctSelectorsPerDay: number;
  maxDistinctRefDomainsPerDay: number;
  maxDistinctUtmCampaignsPerDay: number;
}

export const DEFAULT_CARDINALITY_LIMITS: CardinalityLimits = {
  maxDistinctEventKeysPerDay: 50000,
  maxDistinctPathsPerDay: 10000,
  maxDistinctDimensionValuesPerKeyPerDay: 5000,
  maxDistinctPerfNamesPerDay: 20000,
  maxDistinctSelectorsPerDay: 50000,
  maxDistinctRefDomainsPerDay: 10000,
  maxDistinctUtmCampaignsPerDay: 20000,
};

/**
 * Load cardinality limits for a site
 * Falls back to defaults if site config not found
 */
export async function getCardinalityLimits(siteId: string): Promise<CardinalityLimits> {
  const db = getDb();
  
  try {
    const config = await db
      .select()
      .from(siteConfig)
      .where(eq(siteConfig.siteId, siteId))
      .limit(1);

    if (config.length > 0) {
      return {
        maxDistinctEventKeysPerDay: config[0].maxDistinctEventKeysPerDay,
        maxDistinctPathsPerDay: config[0].maxDistinctPathsPerDay,
        maxDistinctDimensionValuesPerKeyPerDay: config[0].maxDistinctDimensionValuesPerKeyPerDay,
        maxDistinctPerfNamesPerDay: config[0].maxDistinctPerfNamesPerDay,
        maxDistinctSelectorsPerDay: config[0].maxDistinctSelectorsPerDay,
        maxDistinctRefDomainsPerDay: 10000, // Keep existing default
        maxDistinctUtmCampaignsPerDay: 20000, // Keep existing default
      };
    }
  } catch (error) {
    // Site config table might not exist yet, use defaults
    console.warn('Failed to load site config, using defaults:', error);
  }

  return DEFAULT_CARDINALITY_LIMITS;
}

export interface CardinalityCheckResult {
  allowed: boolean;
  exceeded: boolean;
}

export interface CardinalityCheckResults {
  path?: CardinalityCheckResult;
  refDomain?: CardinalityCheckResult;
  utmCampaign?: CardinalityCheckResult;
  eventKey?: CardinalityCheckResult;
  perfName?: CardinalityCheckResult;
  selector?: CardinalityCheckResult;
  dimensionValue?: CardinalityCheckResult;
}

/**
 * Check cardinality for a dimension value
 */
export async function checkDimensionCardinality(
  siteId: string,
  day: Date,
  dimension: string,
  value: string,
  limit: number
): Promise<CardinalityCheckResult> {
  const db = getDb();
  const dayStr = day.toISOString().split('T')[0];
  const valueHash = createHash('sha256').update(value).digest('hex');

  // Check if already exists
  const existing = await db
    .select()
    .from(dimCardinality)
    .where(
      and(
        eq(dimCardinality.siteId, siteId),
        eq(dimCardinality.day, dayStr),
        eq(dimCardinality.dimension, dimension),
        eq(dimCardinality.valueHash, valueHash)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    return { allowed: true, exceeded: false };
  }

  // Check count
  const countResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(dimCardinality)
    .where(
      and(
        eq(dimCardinality.siteId, siteId),
        eq(dimCardinality.day, dayStr),
        eq(dimCardinality.dimension, dimension)
      )
    );

  const currentCount = Number(countResult[0]?.count || 0);

  if (currentCount >= limit) {
    return { allowed: false, exceeded: true };
  }

  // Record this value
  await db.insert(dimCardinality).values({
    siteId,
    day: dayStr,
    dimension,
    valueHash,
  });

  return { allowed: true, exceeded: false };
}

/**
 * Check cardinality for multiple dimensions at once
 */
export async function checkCardinality(
  siteId: string,
  day: Date,
  values: {
    path?: string | null;
    refDomain?: string | null;
    utmCampaign?: string | null;
    eventKey?: string | null;
    perfName?: string | null;
    selector?: string | null;
    dimensionValue?: { key: string; value: string } | null;
  }
): Promise<CardinalityCheckResults> {
  const limits = await getCardinalityLimits(siteId);
  const results: CardinalityCheckResults = {};

  // Check path
  if (values.path) {
    results.path = await checkDimensionCardinality(
      siteId,
      day,
      'path',
      values.path,
      limits.maxDistinctPathsPerDay
    );
  }

  // Check refDomain
  if (values.refDomain) {
    results.refDomain = await checkDimensionCardinality(
      siteId,
      day,
      'ref_domain',
      values.refDomain,
      limits.maxDistinctRefDomainsPerDay
    );
  }

  // Check utmCampaign
  if (values.utmCampaign) {
    results.utmCampaign = await checkDimensionCardinality(
      siteId,
      day,
      'utm_campaign',
      values.utmCampaign,
      limits.maxDistinctUtmCampaignsPerDay
    );
  }

  // Check eventKey
  if (values.eventKey) {
    results.eventKey = await checkDimensionCardinality(
      siteId,
      day,
      'event_key',
      values.eventKey,
      limits.maxDistinctEventKeysPerDay
    );
  }

  // Check perfName
  if (values.perfName) {
    results.perfName = await checkDimensionCardinality(
      siteId,
      day,
      'perf_name',
      values.perfName,
      limits.maxDistinctPerfNamesPerDay
    );
  }

  // Check selector
  if (values.selector) {
    results.selector = await checkDimensionCardinality(
      siteId,
      day,
      'selector',
      values.selector,
      limits.maxDistinctSelectorsPerDay
    );
  }

  // Check dimensionValue (custom dimension)
  if (values.dimensionValue) {
    const dimensionKey = `dimension:${values.dimensionValue.key}`;
    results.dimensionValue = await checkDimensionCardinality(
      siteId,
      day,
      dimensionKey,
      values.dimensionValue.value,
      limits.maxDistinctDimensionValuesPerKeyPerDay
    );
  }

  return results;
}
