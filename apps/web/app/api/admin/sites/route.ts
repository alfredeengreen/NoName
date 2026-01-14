import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { getCurrentUser } from '@/lib/auth-helpers';
import { getPool } from '@analytics/db';
import { sites, orgs } from '@analytics/db';
import { nanoid } from 'nanoid';

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
    const result = await pool.query(`
      SELECT 
        s.id,
        s.org_id,
        s.name,
        s.public_site_id,
        s.public_write_key,
        s.created_at,
        o.name as org_name
      FROM sites s
      JOIN orgs o ON s.org_id = o.id
      ORDER BY s.created_at DESC
    `);

    const sitesList = result.rows.map((row) => ({
      id: row.id,
      orgId: row.org_id,
      orgName: row.org_name,
      name: row.name,
      publicSiteId: row.public_site_id,
      publicWriteKey: row.public_write_key,
      createdAt: row.created_at,
    }));

    return NextResponse.json({ sites: sitesList });
  } catch (error) {
    console.error('Error fetching admin sites:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
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

    const { name, orgId } = await request.json();

    if (!name || !orgId) {
      return NextResponse.json({ error: 'Name and org ID required' }, { status: 400 });
    }

    const pool = getPool();
    const siteId = crypto.randomUUID();
    const publicSiteId = nanoid(16);
    const publicWriteKey = nanoid(32);

    await pool.query(`
      INSERT INTO sites (id, org_id, name, public_site_id, public_write_key)
      VALUES ($1, $2, $3, $4, $5)
    `, [siteId, orgId, name, publicSiteId, publicWriteKey]);

    return NextResponse.json({
      success: true,
      site: {
        id: siteId,
        name,
        publicSiteId,
        publicWriteKey,
      },
    });
  } catch (error) {
    console.error('Error creating site:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
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
    const siteId = searchParams.get('id');

    if (!siteId) {
      return NextResponse.json({ error: 'Site ID required' }, { status: 400 });
    }

    const pool = getPool();
    await pool.query('DELETE FROM sites WHERE id = $1', [siteId]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting site:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


