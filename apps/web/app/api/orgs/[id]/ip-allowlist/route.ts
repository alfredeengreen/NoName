import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@analytics/db';
import { ipAllowlist } from '@analytics/db';
import { verifyOrgAccess } from '@/lib/auth-helpers';
import { eq } from 'drizzle-orm';
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

    const db = getDb();
    const entries = await db
      .select()
      .from(ipAllowlist)
      .where(eq(ipAllowlist.orgId, params.id));

    return NextResponse.json(entries);
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

    const db = getDb();
    const [created] = await db
      .insert(ipAllowlist)
      .values({
        id: nanoid(),
        orgId: params.id,
        cidr,
        description: description || null,
        enabled: enabled ?? true,
      })
      .returning();

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error('Error creating IP allowlist entry:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
