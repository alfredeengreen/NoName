import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { getCurrentUser } from '@/lib/auth-helpers';
import { getPool } from '@analytics/db';
import { sites, users, orgs, orgMembers } from '@analytics/db';

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

    // Get system stats
    const [sitesCount, usersCount, orgsCount, eventsToday] = await Promise.all([
      pool.query('SELECT COUNT(*) as count FROM sites'),
      pool.query('SELECT COUNT(*) as count FROM users'),
      pool.query('SELECT COUNT(*) as count FROM orgs'),
      pool.query(`
        SELECT COUNT(*) as count
        FROM events_raw
        WHERE ts >= CURRENT_DATE
      `),
    ]);

    return NextResponse.json({
      stats: {
        sites: Number(sitesCount.rows[0].count),
        users: Number(usersCount.rows[0].count),
        orgs: Number(orgsCount.rows[0].count),
        eventsToday: Number(eventsToday.rows[0].count),
      },
    });
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


