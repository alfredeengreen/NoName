/**
 * Background job: Compute deltas every 15 minutes
 */

import { getDb } from '@analytics/db';
import { sites } from '@analytics/db';
import { computeAllDeltas } from '../delta.js';

export async function runDeltaJob(): Promise<void> {
  const db = getDb();
  
  try {
    // Get all sites
    const allSites = await db.select().from(sites);

    console.log(`[Delta Job] Processing ${allSites.length} sites`);

    for (const site of allSites) {
      try {
        await computeAllDeltas(site.id);
        console.log(`[Delta Job] Completed for site ${site.id}`);
      } catch (error) {
        console.error(`[Delta Job] Error processing site ${site.id}:`, error);
      }
    }

    console.log('[Delta Job] Completed');
  } catch (error) {
    console.error('[Delta Job] Fatal error:', error);
  }
}
