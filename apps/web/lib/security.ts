/**
 * Enterprise security utilities
 */

import { getDb } from '@analytics/db';
import { ipAllowlist, userAuditLog } from '@analytics/db';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';

/**
 * Check if IP address is allowed for org
 */
export async function isIpAllowed(orgId: string, ipAddress: string): Promise<boolean> {
  const db = getDb();
  
  // Get allowlist for org
  const allowlist = await db
    .select()
    .from(ipAllowlist)
    .where(
      and(
        eq(ipAllowlist.orgId, orgId),
        eq(ipAllowlist.enabled, true)
      )
    );

  if (allowlist.length === 0) {
    return true; // No allowlist = allow all
  }

  // Check if IP matches any CIDR
  for (const entry of allowlist) {
    if (ipMatchesCidr(ipAddress, entry.cidr)) {
      return true;
    }
  }

  return false;
}

/**
 * Check if IP matches CIDR notation
 */
function ipMatchesCidr(ip: string, cidr: string): boolean {
  const [network, prefixLength] = cidr.split('/');
  const prefix = parseInt(prefixLength, 10);
  
  const ipNum = ipToNumber(ip);
  const networkNum = ipToNumber(network);
  const mask = (0xffffffff << (32 - prefix)) >>> 0;
  
  return (ipNum & mask) === (networkNum & mask);
}

/**
 * Convert IP address to number
 */
function ipToNumber(ip: string): number {
  return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
}

/**
 * Log user action to audit log
 */
export async function logUserAction(
  userId: string | null,
  orgId: string | null,
  action: string,
  resourceType: string | null,
  resourceId: string | null,
  ipAddress: string | null,
  userAgent: string | null,
  metadata?: Record<string, any>
): Promise<void> {
  const db = getDb();
  
  try {
    await db.insert(userAuditLog).values({
      id: nanoid(),
      userId: userId || null,
      orgId: orgId || null,
      action,
      resourceType: resourceType || null,
      resourceId: resourceId || null,
      ipAddress: ipAddress || null,
      userAgent: userAgent || null,
      metadata: metadata || null,
      createdAt: new Date(),
    });
  } catch (error) {
    // Don't fail request if audit logging fails
    console.error('Failed to log user action:', error);
  }
}

/**
 * Get user audit log
 */
export async function getUserAuditLog(
  orgId: string,
  userId?: string,
  limit: number = 100
) {
  const db = getDb();
  
  const conditions: any[] = [eq(userAuditLog.orgId, orgId)];
  if (userId) {
    conditions.push(eq(userAuditLog.userId, userId));
  }

  return await db
    .select()
    .from(userAuditLog)
    .where(and(...conditions))
    .orderBy(userAuditLog.createdAt)
    .limit(limit);
}
