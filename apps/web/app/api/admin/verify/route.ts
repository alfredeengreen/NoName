import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth-helpers';
import { verifySiteAccess } from '@/lib/auth-helpers';
import { getPool } from '@analytics/db';

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

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = await isAdmin(user.id);
    if (!admin) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const siteId = searchParams.get('siteId');
    if (!siteId) {
      return NextResponse.json({ error: 'Site ID required' }, { status: 400 });
    }

    // Use pool query to avoid drizzle-orm version conflict
    const pool = getPool();
    const result = await pool.query('SELECT * FROM sites WHERE id = $1 LIMIT 1', [siteId]);
    const site = result.rows;

    if (site.length === 0) {
      return NextResponse.json({ error: 'Site not found' }, { status: 404 });
    }

    const COLLECTOR_URL = process.env.COLLECTOR_URL || 'https://noname.fyi/collector';
    const verifyUrl = `${COLLECTOR_URL}/verify/${site[0].public_site_id}`;
    const res = await fetch(verifyUrl);

    if (!res.ok) {
      return NextResponse.json({ error: 'Failed to verify' }, { status: 500 });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error verifying site:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

