/**
 * Background job: Data retention cleanup daily
 */

import { getDb } from '@analytics/db';
import { sites } from '@analytics/db';
import { cleanupRetentionData } from '../privacy.js';

export async function runRetentionJob(): Promise<void> {
  const db = getDb();
  
  try {
    // Get all sites
    const allSites = await db.select().from(sites);

    console.log(`[Retention Job] Processing ${allSites.length} sites`);

    for (const site of allSites) {
      try {
        await cleanupRetentionData(site.id);
        console.log(`[Retention Job] Completed for site ${site.id}`);
      } catch (error) {
        console.error(`[Retention Job] Error processing site ${site.id}:`, error);
      }
    }

    console.log('[Retention Job] Completed');
  } catch (error) {
    console.error('[Retention Job] Fatal error:', error);
  }
}
