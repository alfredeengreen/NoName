import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth-helpers';
import { getPool } from '@analytics/db';

export const dynamic = 'force-dynamic';

/**
 * Check if user is admin/owner of any org
 */
async function isAdmin(userId: string): Promise<boolean> {
  const pool = getPool();
  const result = await pool.query(`
    SELECT COUNT(*) as count
    FROM org_members
    WHERE user_id = $1 AND role IN ('owner', 'admin')
    LIMIT 1
  `, [userId]);

  return Number(result.rows[0].count) > 0;
}

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = await isAdmin(user.id);
    if (!admin) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const pool = getPool();

    // Get all users with their org memberships
    const result = await pool.query(`
      SELECT 
        u.id,
        u.email,
        u.created_at,
        COALESCE(
          json_agg(
            json_build_object(
              'orgId', o.id,
              'orgName', o.name,
              'role', om.role
            )
          ) FILTER (WHERE o.id IS NOT NULL),
          '[]'::json
        ) as orgs
      FROM users u
      LEFT JOIN org_members om ON u.id = om.user_id
      LEFT JOIN orgs o ON om.org_id = o.id
      GROUP BY u.id, u.email, u.created_at
      ORDER BY u.created_at DESC
    `);

    const users = result.rows.map((row: any) => ({
      id: row.id,
      email: row.email,
      createdAt: row.created_at,
      orgs: row.orgs || [],
    }));

    return NextResponse.json({ users });
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


