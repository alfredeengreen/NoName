import { FastifyRequest, FastifyReply } from 'fastify';
import { TransportPayloadSchema, type TransportPayload } from '@analytics/shared';
import {
  normalizePath,
  getDefaultPathRules,
  sanitizeProps,
  normalizeEventName,
  detectDeviceCategory,
  detectOS,
  normalizeUrlName,
  normalizeSelector,
} from '@analytics/shared';
import { getDb } from '@analytics/db';
import { sites, pathRules, eventDefs, eventsRaw, rollupMinute, ingestStats, dimCardinality, ecommerceItems, errors, errorEvents, performanceMetrics, heatmapData, pageScreenshots, formAnalytics, sessionRecordings, siteConfig } from '@analytics/db';
import { eq, and, sql } from 'drizzle-orm';
import Redis from 'ioredis';
import { createHash } from 'node:crypto';
import { checkCardinality as checkCardinalityGovernance } from './governance.js';
import { isReplayEnabled } from './privacy.js';
import { logCardinalityViolation, logNormalization, logEventDrop } from './audit.js';

interface IngestionResult {
  accepted: boolean;
  droppedReason?: string;
}

export async function ingestionHandler(
  request: FastifyRequest,
  reply: FastifyReply,
  redis: Redis
): Promise<IngestionResult> {
  const startTime = Date.now();

  try {
    // Parse and validate payload first (needed for sendBeacon support)
    const body = request.body as unknown;
    const parseResult = TransportPayloadSchema.safeParse(body);

    if (!parseResult.success) {
      console.warn('Invalid payload:', parseResult.error);
      // Get siteId if available for audit logging
      const siteIdForAudit = (request.body as any)?.site_id || request.headers['x-site-id'];
      if (siteIdForAudit) {
        await logEventDrop(siteIdForAudit as string, 'invalid_payload', 1);
      }
      return { accepted: false, droppedReason: 'invalid_payload' };
    }

    const payload = parseResult.data;

    // Get site ID and key from headers (preferred) or payload body (fallback for sendBeacon)
    const siteIdHeader = request.headers['x-site-id'] as string;
    const siteKeyHeader = request.headers['x-site-key'] as string;
    const siteId = siteIdHeader || payload.site_id;
    const siteKey = siteKeyHeader || (payload as any).site_key;

    if (!siteId || !siteKey) {
      console.warn('Missing site credentials:', { siteId: !!siteId, siteKey: !!siteKey, hasHeaderId: !!siteIdHeader, hasHeaderKey: !!siteKeyHeader, hasBodyKey: !!(payload as any).site_key });
      return { accepted: false, droppedReason: 'missing_site_credentials' };
    }

    // Validate site_id matches (if both header and body are present)
    if (siteIdHeader && payload.site_id !== siteIdHeader) {
      return { accepted: false, droppedReason: 'site_id_mismatch' };
    }

    // Authenticate site
    const db = getDb();
    const site = await db.select().from(sites).where(eq(sites.publicSiteId, siteId)).limit(1);

    if (site.length === 0) {
      console.warn('Site not found:', siteId);
      return { accepted: false, droppedReason: 'invalid_site_key' };
    }
    if (site[0].publicWriteKey !== siteKey) {
      console.warn('Invalid site key:', { siteId, expected: site[0].publicWriteKey, received: siteKey });
      return { accepted: false, droppedReason: 'invalid_site_key' };
    }

    const siteRecord = site[0];

    // Load path rules
    const pathRulesResult = await db
      .select()
      .from(pathRules)
      .where(eq(pathRules.siteId, siteRecord.id))
      .limit(1);

    const rules = pathRulesResult.length > 0 ? pathRulesResult[0].rulesJson : getDefaultPathRules();

    // Load site config for normalization settings
    const siteConfigResult = await db
      .select()
      .from(siteConfig)
      .where(eq(siteConfig.siteId, siteRecord.id))
      .limit(1);

    const siteConfigData = siteConfigResult.length > 0 ? siteConfigResult[0] : null;
    const allowedQueryParams: string[] = siteConfigData?.allowedQueryParams || [];
    const selectorMode = siteConfigData?.selectorMode || 'lenient';

    // Normalize path - returns both raw and normalized
    const pathResult = normalizePath(payload.path, rules, allowedQueryParams);
    const normalizedPath = pathResult.normalizedPath;
    const rawPath = pathResult.rawPath;

    // Sanitize ref_domain
    let refDomain: string | null = null;
    if (payload.ref_domain) {
      try {
        const url = new URL(payload.ref_domain.startsWith('http') ? payload.ref_domain : `https://${payload.ref_domain}`);
        refDomain = url.hostname.substring(0, 80);
      } catch {
        refDomain = payload.ref_domain.substring(0, 80);
      }
    }

    // Sanitize UTM params
    const utmSource = payload.utm?.source?.substring(0, 80).trim() || null;
    const utmMedium = payload.utm?.medium?.substring(0, 80).trim() || null;
    const utmCampaign = payload.utm?.campaign?.substring(0, 80).trim() || null;
    const utmContent = payload.utm?.content?.substring(0, 80).trim() || null;
    const utmTerm = payload.utm?.term?.substring(0, 80).trim() || null;

    // Derive device info
    let deviceCategory = payload.device?.dc || null;
    let os = payload.device?.os || null;

    if (!deviceCategory && payload.device?.sw) {
      deviceCategory = detectDeviceCategory(payload.device.sw);
    }

    if (!os && payload.device) {
      os = detectOS(payload.device.os);
    }

    const deviceInfo = {
      deviceCategory,
      os,
      sw: payload.device?.sw || null,
      sh: payload.device?.sh || null,
      dpr: payload.device?.dpr || null,
      browserName: payload.device?.browser || null,
      browserVersion: payload.device?.browserVersion || null,
      browserEngine: payload.device?.browserEngine || null,
      language: payload.device?.language || null,
      connectionType: payload.device?.connectionType || null,
    };

    // Check feature flags before processing
    const heatmapEnabled = siteConfigData?.heatmapEnabled ?? false;
    const replayEnabled = siteConfigData?.replayEnabled ?? false;

    // Process based on payload type
    if (payload.type === 'inc') {
      await processIncPayload(payload, siteRecord.id, normalizedPath, rawPath, refDomain, {
        utmSource,
        utmMedium,
        utmCampaign,
        utmContent,
        utmTerm,
        ...deviceInfo,
      }, redis);
    } else if (payload.type === 'event') {
      // Check if event should be processed based on feature flags
      const eventName = (payload as any).name;
      if (eventName === 'heatmap' && !heatmapEnabled) {
        await logEventDrop(siteRecord.id, 'feature_disabled', 1);
        return { accepted: false, droppedReason: 'feature_disabled' };
      }
      if (eventName === 'recording' && !replayEnabled) {
        await logEventDrop(siteRecord.id, 'feature_disabled', 1);
        return { accepted: false, droppedReason: 'feature_disabled' };
      }

      // Pass selector mode to processEventPayload via payload metadata
      const payloadWithConfig = { ...payload, __selectorMode: selectorMode } as any;

      await processEventPayload(
        payloadWithConfig,
        siteRecord.id,
        normalizedPath,
        rawPath,
        refDomain,
        {
          utmSource,
          utmMedium,
          utmCampaign,
          utmContent,
          utmTerm,
          ...deviceInfo,
        },
        redis,
        siteConfigData
      );
    } else if (payload.type === 'session') {
      await processSessionPayload(payload, siteRecord.id, normalizedPath, rawPath, refDomain, {
        utmSource,
        utmMedium,
        utmCampaign,
        utmContent,
        utmTerm,
        ...deviceInfo,
      }, redis);
    }

    // Update ingest stats
    await updateIngestStats(siteRecord.id, true);

    // Push to realtime
    const eventSummary = {
      type: payload.type,
      name: payload.type === 'event' ? payload.name : undefined,
      path: normalizedPath,
      ts: payload.ts,
      vid: payload.vid,
      sid: payload.sid,
    };

    await pushToRealtime(redis, siteRecord.publicSiteId, eventSummary);

    return { accepted: true };
  } catch (error) {
    console.error('Ingestion error:', error);
    if (error instanceof Error) {
      console.error('Error stack:', error.stack);
    }
    return { accepted: false, droppedReason: 'internal_error' };
  }
}

async function processIncPayload(
  payload: Extract<TransportPayload, { type: 'inc' }>,
  siteId: string,
  path: string,
  rawPath: string,
  refDomain: string | null,
  dimensions: {
    utmSource: string | null;
    utmMedium: string | null;
    utmCampaign: string | null;
    utmContent: string | null;
    utmTerm: string | null;
    deviceCategory: string | null;
    os: string | null;
    sw: number | null;
    sh: number | null;
    dpr: number | null;
    browserName: string | null;
    browserVersion: string | null;
    browserEngine: string | null;
    language: string | null;
    connectionType: string | null;
  },
  redis: Redis
) {
  const db = getDb();
  const minuteTs = new Date(Math.floor(payload.ts * 1000));
  minuteTs.setSeconds(0, 0);

  // Check cardinality for path and dimensions
  const day = new Date(minuteTs);
  day.setHours(0, 0, 0, 0);

  const cardinalityChecks = await checkCardinalityGovernance(siteId, day, {
    path,
    refDomain,
    utmCampaign: dimensions.utmCampaign,
  });

  // Use null for dimensions that exceeded cardinality
  const finalPath = cardinalityChecks.path?.allowed ? path : null;
  const finalRefDomain = cardinalityChecks.refDomain?.allowed ? refDomain : null;
  const finalUtmCampaign = cardinalityChecks.utmCampaign?.allowed ? dimensions.utmCampaign : null;
  
  // Log cardinality violations
  if (cardinalityChecks.path?.exceeded) {
    const valueHash = createHash('sha256').update(path).digest('hex');
    await logCardinalityViolation(siteId, 'path', valueHash, 'dropped', 1);
    await updateIngestStats(siteId, false, 'droppedCardinality');
  }
  if (cardinalityChecks.refDomain?.exceeded) {
    const valueHash = createHash('sha256').update(refDomain || '').digest('hex');
    await logCardinalityViolation(siteId, 'ref_domain', valueHash, 'dropped', 1);
    await updateIngestStats(siteId, false, 'droppedCardinality');
  }
  if (cardinalityChecks.utmCampaign?.exceeded) {
    const valueHash = createHash('sha256').update(dimensions.utmCampaign || '').digest('hex');
    await logCardinalityViolation(siteId, 'utm_campaign', valueHash, 'dropped', 1);
    await updateIngestStats(siteId, false, 'droppedCardinality');
  }

  // Log normalization if path was normalized
  if (rawPath !== path) {
    await logNormalization(siteId, 'path', rawPath, path);
  }

  // Extract custom dimensions from payload
  const customDims = payload.custom_dimensions || null;

  // Insert into events_raw
  await db.insert(eventsRaw).values({
    siteId,
    ts: new Date(payload.ts * 1000),
    vid: payload.vid,
    sid: payload.sid,
    path: finalPath || path,
    rawPath: rawPath,
    eventType: 'inc',
    refDomain: finalRefDomain,
    utmSource: dimensions.utmSource,
    utmMedium: dimensions.utmMedium,
    utmCampaign: finalUtmCampaign,
    utmContent: dimensions.utmContent,
    utmTerm: dimensions.utmTerm,
    deviceCategory: dimensions.deviceCategory,
    os: dimensions.os,
    sw: dimensions.sw,
    sh: dimensions.sh,
    dpr: dimensions.dpr ? dimensions.dpr.toString() : null,
    browserName: dimensions.browserName,
    browserVersion: dimensions.browserVersion,
    browserEngine: dimensions.browserEngine,
    language: dimensions.language,
    connectionType: dimensions.connectionType,
    customDimensions: customDims,
  });

  // Update rollup_minute for each counter
  for (const [eventKey, count] of Object.entries(payload.counters)) {
    await db
      .insert(rollupMinute)
      .values({
        siteId,
        minuteTs,
        path: finalPath || '',
        eventKey,
        country: '', // Empty string for NULL (PRIMARY KEY constraint)
        deviceCategory: dimensions.deviceCategory || '',
        os: dimensions.os || '',
        refDomain: finalRefDomain || '',
        utmSource: dimensions.utmSource || '',
        utmMedium: dimensions.utmMedium || '',
        utmCampaign: finalUtmCampaign || '',
        count,
        valueSum: null,
      })
      .onConflictDoUpdate({
        target: [
          rollupMinute.siteId,
          rollupMinute.minuteTs,
          rollupMinute.path,
          rollupMinute.eventKey,
          rollupMinute.country,
          rollupMinute.deviceCategory,
          rollupMinute.os,
          rollupMinute.refDomain,
          rollupMinute.utmSource,
          rollupMinute.utmMedium,
          rollupMinute.utmCampaign,
        ],
        set: {
          count: sql`${rollupMinute.count} + ${count}`,
        },
      });
  }
}

async function processEventPayload(
  payload: Extract<TransportPayload, { type: 'event' }> | any,
  siteId: string,
  path: string,
  rawPath: string,
  refDomain: string | null,
  dimensions: {
    utmSource: string | null;
    utmMedium: string | null;
    utmCampaign: string | null;
    utmContent: string | null;
    utmTerm: string | null;
    deviceCategory: string | null;
    os: string | null;
    sw: number | null;
    sh: number | null;
    dpr: number | null;
    browserName: string | null;
    browserVersion: string | null;
    browserEngine: string | null;
    language: string | null;
    connectionType: string | null;
  },
  redis: Redis,
  siteConfigData?: any
) {
  const db = getDb();
  const normalizedEventName = normalizeEventName(payload.name);

  // Lookup or create event_defs
  let eventDef = await db
    .select()
    .from(eventDefs)
    .where(and(eq(eventDefs.siteId, siteId), eq(eventDefs.eventName, normalizedEventName)))
    .limit(1);

  if (eventDef.length === 0) {
    // Auto-create with defaults
    const [newDef] = await db
      .insert(eventDefs)
      .values({
        id: crypto.randomUUID(),
        siteId,
        eventName: normalizedEventName,
        enabled: true,
        propsAllowlist: [],
        valueRule: { mode: 'none' },
      })
      .returning();
    eventDef = [newDef];
  }

  const def = eventDef[0];

  // Check if enabled
  if (!def.enabled) {
    await updateIngestStats(siteId, false, 'droppedInvalid');
    return;
  }

  // Filter props by allowlist
  let cleanProps: Record<string, unknown> | null = null;
  let droppedPiiCount = 0;
  let rawSelector: string | null = null;

  if (payload.props) {
    const sanitizeResult = sanitizeProps(payload.props);
    droppedPiiCount = sanitizeResult.droppedCount;

    // Extract and normalize selector if present (for click/frustration events)
    // Get selector mode from site config (passed via context)
    const currentSelectorMode = (payload as any).__selectorMode || 'lenient';
    if (sanitizeResult.cleanProps.elementId && typeof sanitizeResult.cleanProps.elementId === 'string') {
      rawSelector = sanitizeResult.cleanProps.elementId;
      // Normalize selector using site config
      const normalizedSelector = normalizeSelector(rawSelector, { selectorMode: currentSelectorMode });
      sanitizeResult.cleanProps.elementId = normalizedSelector;
    }

    // If allowlist is empty, allow all props (after sanitization)
    // If allowlist has items, only allow those items
    if (def.propsAllowlist && def.propsAllowlist.length > 0) {
      // Apply allowlist
      const allowedKeys = new Set(def.propsAllowlist.map((p) => p.key));
      cleanProps = {};
      for (const [key, value] of Object.entries(sanitizeResult.cleanProps)) {
        if (allowedKeys.has(key)) {
          cleanProps[key] = value;
        }
      }
    } else {
      // No allowlist - allow all sanitized props
      cleanProps = sanitizeResult.cleanProps;
    }
  }

  // Compute value
  let finalValue: string | null = null;
  if (def.valueRule) {
    if (def.valueRule.mode === 'fixed' && def.valueRule.fixedValue !== undefined) {
      finalValue = def.valueRule.fixedValue.toString();
    } else if (def.valueRule.mode === 'prop' && def.valueRule.propKey && cleanProps) {
      const propValue = cleanProps[def.valueRule.propKey];
      if (typeof propValue === 'number') {
        finalValue = propValue.toString();
      }
    } else if (payload.value !== undefined) {
      // Special case: purchase event always allows value
      finalValue = payload.value.toString();
    }
  }

  const minuteTs = new Date(Math.floor(payload.ts * 1000));
  minuteTs.setSeconds(0, 0);

  const day = new Date(minuteTs);
  day.setHours(0, 0, 0, 0);

  const cardinalityChecks = await checkCardinalityGovernance(siteId, day, {
    path,
    refDomain,
    utmCampaign: dimensions.utmCampaign,
  });

  const finalPath = cardinalityChecks.path?.allowed ? path : null;
  const finalRefDomain = cardinalityChecks.refDomain?.allowed ? refDomain : null;
  const finalUtmCampaign = cardinalityChecks.utmCampaign?.allowed ? dimensions.utmCampaign : null;

  const eventKey = normalizedEventName === 'purchase' ? 'purchase' : `custom:${normalizedEventName}`;

  // Extract custom dimensions from payload
  const customDims = payload.custom_dimensions || null;

  // Check if this is an error event
  if (normalizedEventName === 'error' && payload.props) {
    await processErrorEvent(payload, siteId, path, dimensions, payload.props);
  }
  
  // Check if this is a performance event
  if (normalizedEventName === 'performance' && payload.props) {
    await processPerformanceEvent(payload, siteId, path, payload.props);
  }
  
  // Check if this is a heatmap event
  if (normalizedEventName === 'heatmap' && payload.props) {
    await processHeatmapEvent(payload, siteId, path, payload.props);
  }
  
  // Check if this is a form analytics event
  if (normalizedEventName === 'form_field' && payload.props) {
    await processFormAnalyticsEvent(payload, siteId, payload.props);
  }
  
  // Check if this is a recording event
  if (normalizedEventName === 'recording' && payload.props) {
    await processRecordingEvent(payload, siteId, path, payload.props, siteConfigData);
  }

  // Insert into events_raw
  const [insertedEvent] = await db.insert(eventsRaw).values({
    siteId,
    ts: new Date(payload.ts * 1000),
    vid: payload.vid,
    sid: payload.sid,
    path: finalPath || path,
    rawPath: rawPath,
    rawSelector: rawSelector,
    eventType: 'event',
    eventName: normalizedEventName,
    refDomain: finalRefDomain,
    utmSource: dimensions.utmSource,
    utmMedium: dimensions.utmMedium,
    utmCampaign: finalUtmCampaign,
    utmContent: dimensions.utmContent,
    utmTerm: dimensions.utmTerm,
    deviceCategory: dimensions.deviceCategory,
    os: dimensions.os,
    sw: dimensions.sw,
    sh: dimensions.sh,
    dpr: dimensions.dpr ? dimensions.dpr.toString() : null,
    browserName: dimensions.browserName,
    browserVersion: dimensions.browserVersion,
    browserEngine: dimensions.browserEngine,
    language: dimensions.language,
    connectionType: dimensions.connectionType,
    props: cleanProps,
    value: finalValue,
    currency: payload.currency || null,
    customDimensions: customDims,
  }).returning();

  // Insert e-commerce items if present
  if (payload.items && Array.isArray(payload.items) && insertedEvent) {
    const itemsToInsert = payload.items.map((item: any) => ({
      eventId: insertedEvent.id,
      siteId,
      itemId: item.item_id || '',
      itemName: item.item_name || null,
      itemCategory: item.item_category || null,
      itemBrand: item.item_brand || null,
      quantity: item.quantity || null,
      price: item.price ? item.price.toString() : null,
      revenue: item.quantity && item.price ? (item.quantity * item.price).toString() : null,
    }));

    if (itemsToInsert.length > 0) {
      await db.insert(ecommerceItems).values(itemsToInsert);
    }
  }

  // Update rollup
  await db
    .insert(rollupMinute)
    .values({
      siteId,
      minuteTs,
      path: finalPath || '',
      eventKey,
      country: '', // Empty string for NULL (PRIMARY KEY constraint)
      deviceCategory: dimensions.deviceCategory || '',
      os: dimensions.os || '',
      refDomain: finalRefDomain || '',
      utmSource: dimensions.utmSource || '',
      utmMedium: dimensions.utmMedium || '',
      utmCampaign: finalUtmCampaign || '',
      count: 1,
      valueSum: finalValue,
    })
    .onConflictDoUpdate({
      target: [
        rollupMinute.siteId,
        rollupMinute.minuteTs,
        rollupMinute.path,
        rollupMinute.eventKey,
        rollupMinute.country,
        rollupMinute.deviceCategory,
        rollupMinute.os,
        rollupMinute.refDomain,
        rollupMinute.utmSource,
        rollupMinute.utmMedium,
        rollupMinute.utmCampaign,
      ],
      set: {
        count: sql`${rollupMinute.count} + 1`,
        valueSum: finalValue
          ? sql`COALESCE(${rollupMinute.valueSum}, 0) + ${finalValue}::numeric`
          : sql`${rollupMinute.valueSum}`,
      },
    });

  if (droppedPiiCount > 0) {
    await updateIngestStats(siteId, false, 'droppedPii', droppedPiiCount);
  }
}

async function processSessionPayload(
  payload: Extract<TransportPayload, { type: 'session' }>,
  siteId: string,
  path: string,
  rawPath: string,
  refDomain: string | null,
  dimensions: {
    utmSource: string | null;
    utmMedium: string | null;
    utmCampaign: string | null;
    utmContent: string | null;
    utmTerm: string | null;
    deviceCategory: string | null;
    os: string | null;
    sw: number | null;
    sh: number | null;
    dpr: number | null;
    browserName: string | null;
    browserVersion: string | null;
    browserEngine: string | null;
    language: string | null;
    connectionType: string | null;
  },
  redis: Redis
) {
  const db = getDb();

  // Extract custom dimensions and user properties from payload
  const customDims = payload.custom_dimensions || null;
  const userProps = payload.user_properties || null;
  // Merge user properties into props
  const sessionProps = payload.pages ? { pages: payload.pages, ...(userProps || {}) } : (userProps || null);

  // Insert into events_raw
  await db.insert(eventsRaw).values({
    siteId,
    ts: new Date(payload.ts * 1000),
    vid: payload.vid,
    sid: payload.sid,
    path,
    rawPath: rawPath,
    eventType: 'session',
    refDomain,
    utmSource: dimensions.utmSource,
    utmMedium: dimensions.utmMedium,
    utmCampaign: dimensions.utmCampaign,
    utmContent: dimensions.utmContent,
    utmTerm: dimensions.utmTerm,
    deviceCategory: dimensions.deviceCategory,
    os: dimensions.os,
    sw: dimensions.sw,
    sh: dimensions.sh,
    dpr: dimensions.dpr ? dimensions.dpr.toString() : null,
    browserName: dimensions.browserName,
    browserVersion: dimensions.browserVersion,
    browserEngine: dimensions.browserEngine,
    language: dimensions.language,
    connectionType: dimensions.connectionType,
    props: sessionProps,
    customDimensions: customDims,
  });
}

// Legacy checkCardinality function removed - now using governance.ts

async function updateIngestStats(
  siteId: string,
  accepted: boolean,
  dropReason?: 'droppedInvalid' | 'droppedPii' | 'droppedRateLimited' | 'droppedCardinality',
  dropCount: number = 1
) {
  const db = getDb();
  const now = new Date();
  const minuteTs = new Date(now);
  minuteTs.setSeconds(0, 0);

  if (accepted) {
    await db
      .insert(ingestStats)
      .values({
        siteId,
        minuteTs,
        acceptedCount: 1,
        lastEventTs: now,
      })
      .onConflictDoUpdate({
        target: [ingestStats.siteId, ingestStats.minuteTs],
        set: {
          acceptedCount: sql`${ingestStats.acceptedCount} + 1`,
          lastEventTs: now,
        },
      });
  } else if (dropReason) {
    const updateValues: any = {
      siteId,
      minuteTs,
      [dropReason]: dropCount,
    };
    
    const setClause: any = {};
    if (dropReason === 'droppedInvalid') {
      setClause.droppedInvalid = sql`${ingestStats.droppedInvalid} + ${dropCount}`;
    } else if (dropReason === 'droppedPii') {
      setClause.droppedPii = sql`${ingestStats.droppedPii} + ${dropCount}`;
    } else if (dropReason === 'droppedRateLimited') {
      setClause.droppedRateLimited = sql`${ingestStats.droppedRateLimited} + ${dropCount}`;
    } else if (dropReason === 'droppedCardinality') {
      setClause.droppedCardinality = sql`${ingestStats.droppedCardinality} + ${dropCount}`;
    }
    
    await db
      .insert(ingestStats)
      .values(updateValues)
      .onConflictDoUpdate({
        target: [ingestStats.siteId, ingestStats.minuteTs],
        set: setClause,
      });
  }
}

async function processErrorEvent(
  payload: Extract<TransportPayload, { type: 'event' }>,
  siteId: string,
  path: string,
  dimensions: {
    deviceCategory: string | null;
    os: string | null;
    browserName: string | null;
  },
  errorProps: Record<string, unknown>
) {
  const db = getDb();
  
  // Extract error data from props
  const fingerprint = (errorProps.fingerprint as string) || 'unknown';
  const type = (errorProps.type as string) || 'js';
  const message = (errorProps.message as string) || 'Unknown error';
  const url = (errorProps.url as string) || path;
  const line = errorProps.line ? parseInt(String(errorProps.line), 10) : null;
  const column = errorProps.column ? parseInt(String(errorProps.column), 10) : null;
  
  // Parse JSON strings from props
  let stackTrace: any[] | null = null;
  let breadcrumbs: any[] | null = null;
  let context: Record<string, any> | null = null;
  
  try {
    if (typeof errorProps.stackTrace === 'string') {
      stackTrace = JSON.parse(errorProps.stackTrace);
    }
    if (typeof errorProps.breadcrumbs === 'string') {
      breadcrumbs = JSON.parse(errorProps.breadcrumbs);
    }
    if (typeof errorProps.context === 'string') {
      context = JSON.parse(errorProps.context);
    }
  } catch (e) {
    // Invalid JSON, ignore
  }
  
  const now = new Date(payload.ts * 1000);
  
  // Check if error with this fingerprint already exists
  const existingError = await db
    .select()
    .from(errors)
    .where(and(eq(errors.siteId, siteId), eq(errors.fingerprint, fingerprint)))
    .limit(1);
  
  if (existingError.length > 0) {
    // Update existing error
    const error = existingError[0];
    await db
      .update(errors)
      .set({
        lastSeen: now,
        count: sql`${errors.count} + 1`,
      })
      .where(eq(errors.id, error.id));
    
    // Insert error event
    await db.insert(errorEvents).values({
      errorId: error.id,
      siteId, // error_events table requires site_id
      vid: payload.vid,
      sid: payload.sid,
      path,
      ts: now, // Use 'ts' field name (maps to 'ts' column)
      props: {
        stackTrace: stackTrace || null,
        line,
        column,
        breadcrumbs: breadcrumbs || null,
        context: context || null,
        browser: dimensions.browserName,
        os: dimensions.os,
        device: dimensions.deviceCategory,
      },
    });
  } else {
    // Create new error
    // Generate ID using fingerprint + siteId for uniqueness
    const errorId = `${siteId}_${fingerprint}`;
    
    const [newError] = await db
      .insert(errors)
      .values({
        id: errorId, // Use generated ID (TEXT)
        siteId,
        fingerprint,
        type: type as 'js' | 'network' | 'resource' | 'promise',
        message,
        url: url || path,
        firstSeen: now,
        lastSeen: now,
        count: 1,
        resolved: false,
      })
      .returning();
    
    // Insert error event
    await db.insert(errorEvents).values({
      errorId: newError.id,
      siteId, // error_events table requires site_id
      vid: payload.vid,
      sid: payload.sid,
      path,
      ts: now, // Use 'ts' field name (maps to 'ts' column)
      props: {
        stackTrace: stackTrace || null,
        line,
        column,
        breadcrumbs: breadcrumbs || null,
        context: context || null,
        browser: dimensions.browserName,
        os: dimensions.os,
        device: dimensions.deviceCategory,
      },
    });
  }
}

async function processPerformanceEvent(
  payload: Extract<TransportPayload, { type: 'event' }>,
  siteId: string,
  path: string,
  perfProps: Record<string, unknown>
) {
  const db = getDb();
  
  const type = (perfProps.type as string) || 'api';
  const rawName = (perfProps.name as string) || path;
  const normalizedName = normalizeUrlName(rawName);
  const duration = perfProps.duration ? parseInt(String(perfProps.duration), 10) : 0;
  const status = perfProps.status ? parseInt(String(perfProps.status), 10) : null;
  const size = perfProps.size ? parseInt(String(perfProps.size), 10) : null;
  
  await db.insert(performanceMetrics).values({
    siteId,
    type: type as 'api' | 'resource' | 'navigation',
    name: rawName.substring(0, 512), // Limit name length (raw)
    normalizedName: normalizedName.substring(0, 512), // Normalized/templated name
    duration,
    status,
    size,
    timestamp: new Date(payload.ts * 1000), // Field name 'timestamp' maps to 'ts' column in DB
    props: perfProps, // Store full props for additional metadata
  });
}

async function processHeatmapEvent(
  payload: Extract<TransportPayload, { type: 'event' }>,
  siteId: string,
  path: string,
  heatmapProps: Record<string, unknown>
) {
  const db = getDb();
  
  const type = (heatmapProps.type as string) || 'click';
  const deviceCategory = (heatmapProps.deviceCategory as string) || null;
  let points: Array<{ x: number; y: number }> = [];
  
  try {
    // Handle both string (JSON) and array formats
    if (typeof heatmapProps.points === 'string') {
      points = JSON.parse(heatmapProps.points);
    } else if (Array.isArray(heatmapProps.points)) {
      points = heatmapProps.points as Array<{ x: number; y: number }>;
    }
  } catch (e) {
    console.warn('Failed to parse heatmap points:', e);
    return;
  }
  
  if (!Array.isArray(points) || points.length === 0) {
    return;
  }
  
  // Store screenshot if provided
  if (heatmapProps.screenshot && typeof heatmapProps.screenshot === 'string') {
    const screenshotId = `${siteId}_${path.replace(/[^a-zA-Z0-9]/g, '_')}`;
    const viewportWidth = typeof heatmapProps.viewportWidth === 'number' ? heatmapProps.viewportWidth : null;
    const viewportHeight = typeof heatmapProps.viewportHeight === 'number' ? heatmapProps.viewportHeight : null;
    
    try {
      // Check if screenshot exists
      const existing = await db
        .select()
        .from(pageScreenshots)
        .where(
          and(
            eq(pageScreenshots.siteId, siteId),
            eq(pageScreenshots.path, path)
          )
        )
        .limit(1);
      
      if (existing.length > 0) {
        // Update existing
        await db
          .update(pageScreenshots)
          .set({
            screenshotData: heatmapProps.screenshot,
            viewportWidth,
            viewportHeight,
            updatedAt: new Date(),
          })
          .where(eq(pageScreenshots.id, existing[0].id));
      } else {
        // Insert new
        await db.insert(pageScreenshots).values({
          id: screenshotId,
          siteId,
          path,
          screenshotData: heatmapProps.screenshot,
          viewportWidth,
          viewportHeight,
        });
      }
    } catch (e) {
      console.warn('Failed to store screenshot:', e);
    }
  }
  
  // Aggregate points by position (group same x,y together)
  const aggregated = new Map<string, number>();
  points.forEach(point => {
    const key = `${point.x},${point.y}`;
    aggregated.set(key, (aggregated.get(key) || 0) + 1);
  });
  
  // Insert aggregated points
  const valuesToInsert = Array.from(aggregated.entries()).map(([key, intensity]) => {
    const [x, y] = key.split(',').map(Number);
    return {
      siteId,
      path,
      type: type as 'click' | 'scroll' | 'move',
      x,
      y,
      intensity,
      deviceCategory,
      ts: new Date(payload.ts * 1000),
    };
  });
  
  if (valuesToInsert.length > 0) {
    await db.insert(heatmapData).values(valuesToInsert);
  }
}

async function processFormAnalyticsEvent(
  payload: Extract<TransportPayload, { type: 'event' }>,
  siteId: string,
  formProps: Record<string, unknown>
) {
  const db = getDb();
  
  const formId = (formProps.formId as string) || 'unknown';
  const fieldName = (formProps.fieldName as string) || null;
  const eventType = (formProps.eventType as string) || 'focus';
  const timeSpent = formProps.timeSpent ? parseInt(String(formProps.timeSpent), 10) : null;
  const errorCount = formProps.errorCount ? parseInt(String(formProps.errorCount), 10) : 0;
  
  await db.insert(formAnalytics).values({
    siteId,
    formId: formId.substring(0, 128), // Limit length
    fieldName: fieldName ? fieldName.substring(0, 128) : null,
    eventType: eventType as 'focus' | 'blur' | 'change' | 'submit' | 'abandon' | 'error',
    timestamp: new Date(payload.ts * 1000),
    vid: payload.vid,
    sid: payload.sid,
    timeSpent,
    errorCount,
  });
}

async function processRecordingEvent(
  payload: Extract<TransportPayload, { type: 'event' }>,
  siteId: string,
  path: string,
  recordingProps: Record<string, unknown>,
  siteConfigData?: any
) {
  const db = getDb();
  
  const recordingId = `${payload.sid}_${payload.ts}`;
  const duration = recordingProps.duration ? parseInt(String(recordingProps.duration), 10) : null;
  let events: any[] = [];
  let snapshots: any[] = [];
  let metadata: Record<string, any> = {};
  
  try {
    if (typeof recordingProps.events === 'string') {
      events = JSON.parse(recordingProps.events);
    }
    if (typeof recordingProps.snapshots === 'string') {
      snapshots = JSON.parse(recordingProps.snapshots);
    }
    if (typeof recordingProps.metadata === 'string') {
      metadata = JSON.parse(recordingProps.metadata);
    }
  } catch (e) {
    // Invalid JSON, ignore
    return;
  }
  
  // Apply masking if enabled (default: true)
  const maskingEnabled = siteConfigData?.replayMaskingEnabled ?? true;
  
  const startTime = new Date((payload.ts - (duration || 0)) * 1000);
  const endTime = new Date(payload.ts * 1000);
  
  await db.insert(sessionRecordings).values({
    id: recordingId,
    siteId,
    vid: payload.vid,
    sid: payload.sid,
    path,
    startTime,
    endTime,
    duration,
    masked: maskingEnabled,
    events: events.length > 0 ? events : null,
    snapshots: snapshots.length > 0 ? snapshots : null,
    metadata: Object.keys(metadata).length > 0 ? metadata : null,
  });
}

async function pushToRealtime(redis: Redis, publicSiteId: string, event: unknown) {
  const key = `live:${publicSiteId}`;
  const channel = `livepub:${publicSiteId}`;

  // Push to list (trim to 200)
  await redis.lpush(key, JSON.stringify(event));
  await redis.ltrim(key, 0, 199);

  // Publish to pubsub
  await redis.publish(channel, JSON.stringify(event));
}

