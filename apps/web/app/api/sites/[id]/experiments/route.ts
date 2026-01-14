import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@analytics/db';
import { verifySiteAccess } from '@/lib/auth-helpers';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { authorized, site } = await verifySiteAccess(params.id);
    if (!authorized || !site) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const siteId = params.id;
    const pool = getPool();

    const result = await pool.query(
      'SELECT * FROM experiments WHERE site_id = $1 AND enabled = true ORDER BY name',
      [siteId]
    );

    const exps = result.rows.map(row => ({
      id: row.id,
      siteId: row.site_id,
      name: row.name,
      description: row.description,
      controlVariant: row.control_variant,
      variants: row.variants,
      storageType: row.storage_type,
      storageKey: row.storage_key,
      goalEvent: row.goal_event,
      enabled: row.enabled,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    return NextResponse.json(exps);
  } catch (error) {
    console.error('Error fetching experiments:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { authorized, site } = await verifySiteAccess(params.id);
    if (!authorized || !site) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const siteId = params.id;
    const body = await request.json();
    const { name, storageType, storageKey, variants, conversionEvents, significanceThreshold, description } = body;

    if (!name || !storageType || !storageKey || !variants || !Array.isArray(variants) || variants.length < 2) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!['localStorage', 'cookie'].includes(storageType)) {
      return NextResponse.json({ error: 'Invalid storage type' }, { status: 400 });
    }

    const pool = getPool();
    const id = crypto.randomUUID();

    // Note: The schema shows control_variant, variants, goal_event fields
    // But the request has conversionEvents and significanceThreshold
    // Using the schema fields for now
    const controlVariant = variants[0] || 'control';
    const goalEvent = conversionEvents?.[0] || 'conversion';

    const result = await pool.query(
      `INSERT INTO experiments (id, site_id, name, description, control_variant, variants, storage_type, storage_key, goal_event, enabled, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
       RETURNING *`,
      [
        id,
        siteId,
        name.trim(),
        description?.trim() || null,
        controlVariant,
        JSON.stringify(variants),
        storageType,
        storageKey.trim(),
        goalEvent,
        true,
      ]
    );

    const exp = result.rows[0];
    return NextResponse.json({
      id: exp.id,
      siteId: exp.site_id,
      name: exp.name,
      description: exp.description,
      controlVariant: exp.control_variant,
      variants: exp.variants,
      storageType: exp.storage_type,
      storageKey: exp.storage_key,
      goalEvent: exp.goal_event,
      enabled: exp.enabled,
      createdAt: exp.created_at,
      updatedAt: exp.updated_at,
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating experiment:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

