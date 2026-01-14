import { cookies } from 'next/headers';
import { getDb, getPool } from '@analytics/db';
import { sites, users, orgMembers, orgs } from '@analytics/db';
import { eq, and, gte } from 'drizzle-orm';

/**
 * Get current user from session
 */
export async function getCurrentUser() {
  const sessionCookie = cookies().get('session');
  if (!sessionCookie) {
    return null;
  }

  const pool = getPool();
  
  let client;
  try {
    // Use a client connection that will be properly released
    client = await pool.connect();
    const result = await client.query(`
      SELECT u.id, u.email, u.password_hash, u.created_at
      FROM sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.token = $1 AND s.expires_at >= NOW()
      LIMIT 1
    `, [sessionCookie.value]);

    if (result.rows.length === 0) {
      // Session doesn't exist or expired - clear the cookie
      try {
        cookies().delete('session');
      } catch {
        // Ignore cookie deletion errors
      }
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      email: row.email,
      passwordHash: row.password_hash,
      createdAt: row.created_at,
    };
  } catch (error) {
    console.error('Error getting current user:', error);
    // On error, clear the cookie and return null
    try {
      cookies().delete('session');
    } catch {
      // Ignore cookie deletion errors
    }
    return null;
  } finally {
    if (client) {
      client.release();
    }
  }
}

/**
 * Get all orgs user belongs to
 */
export async function getUserOrgs(userId: string) {
  const pool = getPool();
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT o.id, o.name, o.created_at
      FROM org_members om
      JOIN orgs o ON om.org_id = o.id
      WHERE om.user_id = $1
    `, [userId]);

    return result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      createdAt: row.created_at,
    }));
  } finally {
    client.release();
  }
}

/**
 * Get all sites user has access to (via org membership)
 */
export async function getUserSites(userId: string) {
  const pool = getPool();
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT s.id, s.org_id, s.name, s.public_site_id, s.public_write_key, s.created_at
      FROM sites s
      JOIN org_members om ON s.org_id = om.org_id
      WHERE om.user_id = $1
    `, [userId]);

    return result.rows.map((row) => ({
      id: row.id,
      orgId: row.org_id,
      name: row.name,
      publicSiteId: row.public_site_id,
      publicWriteKey: row.public_write_key,
      createdAt: row.created_at,
    }));
  } finally {
    client.release();
  }
}

export async function verifySiteAccess(siteId: string) {
  const user = await getCurrentUser();
  if (!user) {
    return { authorized: false, site: null, user: null };
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    // Get site and check membership in one query
    const result = await client.query(`
      SELECT s.id, s.org_id, s.name, s.public_site_id, s.public_write_key, s.created_at
      FROM sites s
      JOIN org_members om ON s.org_id = om.org_id
      WHERE s.id = $1 AND om.user_id = $2
      LIMIT 1
    `, [siteId, user.id]);

    if (result.rows.length === 0) {
      return { authorized: false, site: null, user };
    }

    const row = result.rows[0];
    const site = {
      id: row.id,
      orgId: row.org_id,
      name: row.name,
      publicSiteId: row.public_site_id,
      publicWriteKey: row.public_write_key,
      createdAt: row.created_at,
    };

    return { authorized: true, site, user };
  } finally {
    client.release();
  }
}

export async function verifyOrgAccess(orgId: string) {
  const user = await getCurrentUser();
  if (!user) {
    return { authorized: false, userId: null };
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT om.user_id, om.role
      FROM org_members om
      WHERE om.org_id = $1 AND om.user_id = $2
      LIMIT 1
    `, [orgId, user.id]);

    if (result.rows.length === 0) {
      return { authorized: false, userId: null };
    }

    return { authorized: true, userId: user.id, role: result.rows[0].role };
  } finally {
    client.release();
  }
}

