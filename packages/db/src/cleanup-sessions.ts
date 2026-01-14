import { lt } from 'drizzle-orm';
import { getDb } from './client';
import { sessions } from './schema';

/**
 * Delete expired sessions from the database
 * Should be run periodically (e.g., daily via cron)
 */
export async function cleanupExpiredSessions() {
  const db = getDb();
  const now = new Date();

  const result = await db.delete(sessions).where(lt(sessions.expiresAt, now));

  return {
    deleted: result.rowCount || 0,
    timestamp: now,
  };
}

/**
 * Run session cleanup (can be called from cron)
 */
export async function runSessionCleanup() {
  try {
    const result = await cleanupExpiredSessions();
    console.log(`Session cleanup completed: deleted ${result.deleted} expired sessions`);
    return result;
  } catch (error) {
    console.error('Session cleanup failed:', error);
    throw error;
  }
}


