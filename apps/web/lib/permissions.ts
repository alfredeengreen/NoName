import { getPool } from '@analytics/db';

/**
 * Check if user is admin/owner of any org
 */
export async function isAdmin(userId: string): Promise<boolean> {
  const pool = getPool();
  try {
    const result = await pool.query(`
      SELECT COUNT(*) as count
      FROM org_members
      WHERE user_id = $1 AND role IN ('owner', 'admin')
      LIMIT 1
    `, [userId]);

    return Number(result.rows[0]?.count || 0) > 0;
  } catch (error) {
    console.error('Error checking admin status:', error);
    return false;
  }
}

/**
 * Check if user has specific role in an org
 */
export async function hasOrgRole(userId: string, orgId: string, roles: string[]): Promise<boolean> {
  const pool = getPool();
  try {
    const placeholders = roles.map((_, i) => `$${i + 2}`).join(', ');
    const result = await pool.query(`
      SELECT COUNT(*) as count
      FROM org_members
      WHERE user_id = $1 AND org_id = $2 AND role IN (${placeholders})
      LIMIT 1
    `, [userId, orgId, ...roles]);

    return Number(result.rows[0]?.count || 0) > 0;
  } catch (error) {
    console.error('Error checking org role:', error);
    return false;
  }
}

/**
 * Get user's role in an org
 */
export async function getUserRole(userId: string, orgId: string): Promise<string | null> {
  const pool = getPool();
  try {
    const result = await pool.query(`
      SELECT role
      FROM org_members
      WHERE user_id = $1 AND org_id = $2
      LIMIT 1
    `, [userId, orgId]);

    return result.rows[0]?.role || null;
  } catch (error) {
    console.error('Error getting user role:', error);
    return null;
  }
}

/**
 * Require specific permission (placeholder for future implementation)
 */
export function requirePermission(permission: string) {
  // This is a placeholder - full implementation would check permissions
  return async (userId: string, orgId: string) => {
    return hasOrgRole(userId, orgId, ['owner', 'admin']);
  };
}
