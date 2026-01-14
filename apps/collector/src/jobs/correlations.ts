/**
 * Background job: Compute correlations hourly
 */

import { getDb } from '@analytics/db';
import { sites } from '@analytics/db';
import { computeAllCorrelations } from '../correlations.js';

export async function runCorrelationsJob(): Promise<void> {
  const db = getDb();
  
  try {
    // Get all sites
    const allSites = await db.select().from(sites);

    console.log(`[Correlations Job] Processing ${allSites.length} sites`);

    for (const site of allSites) {
      try {
        await computeAllCorrelations(site.id);
        console.log(`[Correlations Job] Completed for site ${site.id}`);
      } catch (error) {
        console.error(`[Correlations Job] Error processing site ${site.id}:`, error);
      }
    }

    console.log('[Correlations Job] Completed');
  } catch (error) {
    console.error('[Correlations Job] Fatal error:', error);
  }
}
