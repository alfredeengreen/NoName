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

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = await isAdmin(user.id);
    if (!admin) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const siteId = body.siteId;
    if (!siteId) {
      return NextResponse.json({ error: 'Site ID required' }, { status: 400 });
    }

    const { authorized, site } = await verifySiteAccess(siteId);
    if (!authorized || !site) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data } = body;

    if (!Array.isArray(data)) {
      return NextResponse.json({ error: 'Data must be an array' }, { status: 400 });
    }

    const collectorEndpoint = process.env.COLLECTOR_ENDPOINT || 'http://localhost:3001';

    const response = await fetch(`${collectorEndpoint}/import`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        siteId: site.publicSiteId,
        key: site.publicWriteKey,
        data,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      return NextResponse.json(result, { status: response.status });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error importing data:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

