/**
 * Enterprise security utilities
 */

import { getPool } from '@analytics/db';

/**
 * Check if IP address is allowed for org
 */
export async function isIpAllowed(orgId: string, ipAddress: string): Promise<boolean> {
  const pool = getPool();
  
  // Get allowlist for org
  const result = await pool.query(
    'SELECT cidr FROM ip_allowlist WHERE org_id = $1 AND enabled = TRUE',
    [orgId]
  );

  if (result.rows.length === 0) {
    return true; // No allowlist = allow all
  }

  // Check if IP matches any CIDR
  for (const entry of result.rows) {
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
  const pool = getPool();
  
  try {
    await pool.query(
      `INSERT INTO user_audit_log (user_id, org_id, action, resource_type, resource_id, ip_address, user_agent, metadata, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
      [
        userId || null,
        orgId || null,
        action,
        resourceType || null,
        resourceId || null,
        ipAddress || null,
        userAgent || null,
        metadata ? JSON.stringify(metadata) : null,
      ]
    );
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
  const pool = getPool();
  
  let query = `
    SELECT * FROM user_audit_log 
    WHERE org_id = $1
  `;
  const params: any[] = [orgId];
  
  if (userId) {
    query += ` AND user_id = $${params.length + 1}`;
    params.push(userId);
  }
  
  query += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`;
  params.push(limit);

  const result = await pool.query(query, params);
  return result.rows.map(row => ({
    id: row.id,
    userId: row.user_id,
    orgId: row.org_id,
    action: row.action,
    resourceType: row.resource_type,
    resourceId: row.resource_id,
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
    metadata: row.metadata,
    createdAt: row.created_at,
  }));
}
