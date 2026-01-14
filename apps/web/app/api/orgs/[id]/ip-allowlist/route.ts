import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@analytics/db';
import { verifyOrgAccess } from '@/lib/auth-helpers';
import { nanoid } from 'nanoid';

/**
 * IP Allowlist Management
 * GET /api/orgs/:id/ip-allowlist - List allowlist entries
 * POST /api/orgs/:id/ip-allowlist - Add allowlist entry
 */

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { authorized } = await verifyOrgAccess(params.id);
    if (!authorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const pool = getPool();
    const result = await pool.query(
      'SELECT id, org_id as "orgId", cidr, description, enabled, created_at as "createdAt" FROM ip_allowlist WHERE org_id = $1',
      [params.id]
    );

    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('Error fetching IP allowlist:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { authorized } = await verifyOrgAccess(params.id);
    if (!authorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { cidr, description, enabled } = body;

    if (!cidr) {
      return NextResponse.json({ error: 'cidr required' }, { status: 400 });
    }

    // Validate CIDR format
    if (!/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\/\d{1,2}$/.test(cidr)) {
      return NextResponse.json({ error: 'Invalid CIDR format' }, { status: 400 });
    }

    const pool = getPool();
    const id = nanoid();
    const result = await pool.query(
      `INSERT INTO ip_allowlist (id, org_id, cidr, description, enabled, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING id, org_id as "orgId", cidr, description, enabled, created_at as "createdAt"`,
      [id, params.id, cidr, description || null, enabled ?? true]
    );

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (error) {
    console.error('Error creating IP allowlist entry:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
