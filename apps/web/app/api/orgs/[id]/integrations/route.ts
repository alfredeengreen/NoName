import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@analytics/db';
import { verifyOrgAccess } from '@/lib/auth-helpers';
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

    const pool = getPool();
    const result = await pool.query(
      'SELECT id, type, name, enabled, created_at as "createdAt", updated_at as "updatedAt" FROM integrations WHERE org_id = $1',
      [params.id]
    );

    // Don't return sensitive config (e.g., API keys)
    return NextResponse.json(result.rows);
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

    const pool = getPool();
    const id = nanoid();
    const result = await pool.query(
      `INSERT INTO integrations (id, org_id, type, name, config, enabled, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
       RETURNING id, org_id as "orgId", type, name, config, enabled, created_at as "createdAt", updated_at as "updatedAt"`,
      [id, params.id, type, name, JSON.stringify(config), true]
    );

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (error) {
    console.error('Error creating integration:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
