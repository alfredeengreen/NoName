/**
 * Privacy enforcement utilities
 */

import { getDb } from '@analytics/db';
import { siteConfig, sessionRecordings } from '@analytics/db';
import { eq, and, sql } from 'drizzle-orm';

/**
 * Check if replay is enabled for a site
 */
export async function isReplayEnabled(siteId: string): Promise<boolean> {
  const db = getDb();
  const config = await db
    .select()
    .from(siteConfig)
    .where(eq(siteConfig.siteId, siteId))
    .limit(1);

  if (config.length === 0) {
    return false; // Default: disabled
  }

  return config[0].replayEnabled;
}

/**
 * Check if replay masking is enabled for a site
 */
export async function isReplayMaskingEnabled(siteId: string): Promise<boolean> {
  const db = getDb();
  const config = await db
    .select()
    .from(siteConfig)
    .where(eq(siteConfig.siteId, siteId))
    .limit(1);

  if (config.length === 0) {
    return true; // Default: enabled
  }

  return config[0].replayMaskingEnabled;
}

/**
 * Get data retention days for a site
 */
export async function getDataRetentionDays(siteId: string): Promise<number> {
  const db = getDb();
  const config = await db
    .select()
    .from(siteConfig)
    .where(eq(siteConfig.siteId, siteId))
    .limit(1);

  if (config.length === 0) {
    return 90; // Default: 90 days
  }

  return config[0].dataRetentionDays;
}

/**
 * Clean up old data based on retention policy
 */
export async function cleanupRetentionData(siteId: string): Promise<void> {
  const db = getDb();
  const retentionDays = await getDataRetentionDays(siteId);
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

  // Delete old events_raw (this would need to be done carefully in production)
  // For now, we'll just mark them or move to archive
  // Actual deletion should be handled by a separate cleanup job with proper backups

  // Delete old session recordings
  await db
    .delete(sessionRecordings)
    .where(
      and(
        eq(sessionRecordings.siteId, siteId),
        sql`start_time < ${cutoffDate}`
      )
    );
}
