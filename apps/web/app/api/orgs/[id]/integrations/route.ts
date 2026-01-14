import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@analytics/db';
import { integrations } from '@analytics/db';
import { verifyOrgAccess } from '@/lib/auth-helpers';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';

/**
 * Integration Management
 * GET /api/orgs/:id/integrations - List integrations
 * POST /api/orgs/:id/integrations - Create integration
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
    const orgIntegrations = await db
      .select()
      .from(integrations)
      .where(eq(integrations.orgId, params.id));

    // Don't return sensitive config (e.g., API keys)
    const safeIntegrations = orgIntegrations.map(i => ({
      id: i.id,
      type: i.type,
      name: i.name,
      enabled: i.enabled,
      createdAt: i.createdAt,
      updatedAt: i.updatedAt,
    }));

    return NextResponse.json(safeIntegrations);
  } catch (error) {
    console.error('Error fetching integrations:', error);
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
    const { type, name, config } = body;

    if (!type || !name || !config) {
      return NextResponse.json({ error: 'type, name, and config are required' }, { status: 400 });
    }

    const db = getDb();
    const [created] = await db
      .insert(integrations)
      .values({
        id: nanoid(),
        orgId: params.id,
        type,
        name,
        config,
        enabled: true,
      })
      .returning();

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error('Error creating integration:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
