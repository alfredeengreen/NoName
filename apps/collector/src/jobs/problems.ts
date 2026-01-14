/**
 * Background job: Detect problems every 5 minutes
 */

import { getDb } from '@analytics/db';
import { sites } from '@analytics/db';
import { detectAllProblems } from '../problems.js';
import { calculateAllBusinessImpacts } from '../business-impact.js';

export async function runProblemsJob(): Promise<void> {
  const db = getDb();
  
  try {
    // Get all sites
    const allSites = await db.select().from(sites);

    console.log(`[Problems Job] Processing ${allSites.length} sites`);

    for (const site of allSites) {
      try {
        // Detect problems
        await detectAllProblems(site.id);
        
        // Calculate business impact (with default config - can be customized per site)
        await calculateAllBusinessImpacts(site.id, {
          averageOrderValue: 100, // Default AOV
          costPerFix: {
            error_spike: 2000,
            perf_slowdown: 4000,
            funnel_drop: 3000,
            ux_friction: 1500,
            form_abandonment: 1000,
          },
        });
        
        console.log(`[Problems Job] Completed for site ${site.id}`);
      } catch (error) {
        console.error(`[Problems Job] Error processing site ${site.id}:`, error);
      }
    }

    console.log('[Problems Job] Completed');
  } catch (error) {
    console.error('[Problems Job] Fatal error:', error);
  }
}
