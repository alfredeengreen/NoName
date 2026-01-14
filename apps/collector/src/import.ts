import { FastifyRequest, FastifyReply } from 'fastify';
import { TransportPayloadSchema, type TransportPayload } from '@analytics/shared';
import { getDb } from '@analytics/db';
import { sites, eventsRaw, ecommerceItems } from '@analytics/db';
import { eq } from 'drizzle-orm';
import { normalizePath, getDefaultPathRules } from '@analytics/shared';

interface ImportResult {
  accepted: number;
  rejected: number;
  errors: Array<{ row: number; error: string }>;
}

export async function importHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<ImportResult> {
  const db = getDb();
  const body = request.body as { siteId: string; key: string; data: any[] };

  // Verify site credentials
  const siteRecord = await db
    .select()
    .from(sites)
    .where(eq(sites.publicSiteId, body.siteId))
    .limit(1);

  if (siteRecord.length === 0) {
    return reply.code(404).send({ error: 'Site not found' });
  }

  const site = siteRecord[0];
  if (site.publicWriteKey !== body.key) {
    return reply.code(401).send({ error: 'Invalid key' });
  }

  const accepted: number[] = [];
  const rejected: Array<{ row: number; error: string }> = [];

  // Process each row
  for (let i = 0; i < body.data.length; i++) {
    const row = body.data[i];
    try {
      // Validate payload
      const payload = TransportPayloadSchema.parse(row);
      
      // Normalize path
      const pathRules = getDefaultPathRules();
      const pathResult = normalizePath(payload.path, pathRules, []);
      const normalizedPath = pathResult.normalizedPath;

      // Insert event
      if (payload.type === 'event') {
        const [insertedEvent] = await db.insert(eventsRaw).values({
          siteId: site.id,
          ts: new Date(payload.ts * 1000),
          vid: payload.vid,
          sid: payload.sid,
          path: normalizedPath,
          eventType: 'event',
          eventName: payload.name,
          refDomain: payload.ref_domain || null,
          utmSource: payload.utm?.source || null,
          utmMedium: payload.utm?.medium || null,
          utmCampaign: payload.utm?.campaign || null,
          utmContent: payload.utm?.content || null,
          utmTerm: payload.utm?.term || null,
          deviceCategory: payload.device?.dc || null,
          os: payload.device?.os || null,
          sw: payload.device?.sw || null,
          sh: payload.device?.sh || null,
          dpr: payload.device?.dpr ? payload.device.dpr.toString() : null,
          browserName: payload.device?.browser || null,
          browserVersion: payload.device?.browserVersion || null,
          browserEngine: payload.device?.browserEngine || null,
          language: payload.device?.language || null,
          connectionType: payload.device?.connectionType || null,
          props: payload.props || null,
          value: payload.value ? payload.value.toString() : null,
          currency: payload.currency || null,
          customDimensions: payload.custom_dimensions || null,
        }).returning();

        // Insert e-commerce items if present
        if (payload.items && Array.isArray(payload.items) && insertedEvent) {
          const itemsToInsert = payload.items.map((item: any) => ({
            eventId: insertedEvent.id,
            siteId: site.id,
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
      } else {
        // Handle inc and session payloads similarly
        await db.insert(eventsRaw).values({
          siteId: site.id,
          ts: new Date(payload.ts * 1000),
          vid: payload.vid,
          sid: payload.sid,
          path: normalizedPath,
          eventType: payload.type,
          refDomain: payload.ref_domain || null,
          utmSource: payload.utm?.source || null,
          utmMedium: payload.utm?.medium || null,
          utmCampaign: payload.utm?.campaign || null,
          utmContent: payload.utm?.content || null,
          utmTerm: payload.utm?.term || null,
          deviceCategory: payload.device?.dc || null,
          os: payload.device?.os || null,
          sw: payload.device?.sw || null,
          sh: payload.device?.sh || null,
          dpr: payload.device?.dpr ? payload.device.dpr.toString() : null,
          browserName: payload.device?.browser || null,
          browserVersion: payload.device?.browserVersion || null,
          browserEngine: payload.device?.browserEngine || null,
          language: payload.device?.language || null,
          connectionType: payload.device?.connectionType || null,
          props: payload.type === 'session' ? (payload.pages ? { pages: payload.pages } : null) : null,
          customDimensions: payload.custom_dimensions || null,
        });
      }

      accepted.push(i);
    } catch (error: any) {
      rejected.push({
        row: i,
        error: error.message || 'Validation failed',
      });
    }
  }

  return {
    accepted: accepted.length,
    rejected: rejected.length,
    errors: rejected,
  };
}

