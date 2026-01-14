import { lt, sql } from 'drizzle-orm';
import { getDb } from './client';
import { eventsRaw } from './schema';

/**
 * Delete events_raw older than retention days
 */
export async function cleanupOldEvents(retentionDays: number = 30) {
  const db = getDb();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

  const result = await db.delete(eventsRaw).where(lt(eventsRaw.ts, cutoffDate));

  return {
    deleted: result.rowCount || 0,
    cutoffDate,
  };
}

/**
 * Run cleanup (can be called from cron)
 */
export async function runCleanup() {
  try {
    const result = await cleanupOldEvents(30);
    console.log(`Cleanup completed: deleted ${result.deleted} events older than ${result.cutoffDate.toISOString()}`);
    return result;
  } catch (error) {
    console.error('Cleanup failed:', error);
    throw error;
  }
}

/**
 * Run all cleanup tasks (events and sessions)
 */
export async function runAllCleanup() {
  try {
    const [eventsResult, sessionsResult] = await Promise.all([
      cleanupOldEvents(30),
      import('./cleanup-sessions').then(m => m.cleanupExpiredSessions()),
    ]);
    console.log(`Full cleanup completed: deleted ${eventsResult.deleted} old events and ${sessionsResult.deleted} expired sessions`);
    return { events: eventsResult, sessions: sessionsResult };
  } catch (error) {
    console.error('Full cleanup failed:', error);
    throw error;
  }
}

