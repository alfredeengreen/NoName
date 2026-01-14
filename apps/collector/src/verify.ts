import { FastifyRequest, FastifyReply } from 'fastify';
import { getDb } from '@analytics/db';
import { sites, eventsRaw, ingestStats } from '@analytics/db';
import { eq, desc, sql, and, gte } from 'drizzle-orm';
import { getIngestStats } from '@analytics/db';

export async function verifyHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { public_site_id } = (request.params as { public_site_id: string });

  // TODO: Add authentication (dashboard session token or admin key)
  // For MVP, we'll skip auth

  const db = getDb();

  // Get site
  const siteResult = await db.select().from(sites).where(eq(sites.publicSiteId, public_site_id)).limit(1);

  if (siteResult.length === 0) {
    return reply.code(404).send({ error: 'Site not found' });
  }

  const site = siteResult[0];

  // Get last event timestamp
  const lastEventResult = await db
    .select({ lastEventTs: sql<Date>`MAX(${eventsRaw.ts})` })
    .from(eventsRaw)
    .where(eq(eventsRaw.siteId, site.id));

  const lastEventTs = lastEventResult[0]?.lastEventTs || null;

  // Get ingest stats for last 10 minutes
  const stats = await getIngestStats(site.id, 10);

  // Get last 5 events
  const recentEvents = await db
    .select()
    .from(eventsRaw)
    .where(eq(eventsRaw.siteId, site.id))
    .orderBy(desc(eventsRaw.ts))
    .limit(5);

  return {
    last_event_ts: lastEventTs ? Math.floor(lastEventTs.getTime() / 1000) : null,
    stats: {
      accepted: stats.acceptedCount,
      dropped_invalid: stats.droppedInvalid,
      dropped_pii: stats.droppedPii,
      dropped_rate_limited: stats.droppedRateLimited,
      dropped_cardinality: stats.droppedCardinality,
    },
    recent_events: recentEvents.map((e) => ({
      type: e.eventType,
      name: e.eventName,
      path: e.path,
      ts: Math.floor(e.ts.getTime() / 1000),
      vid: e.vid,
      sid: e.sid,
    })),
  };
}

