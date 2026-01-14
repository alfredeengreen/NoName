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
      'SELECT * FROM segments WHERE site_id = $1 AND enabled = true ORDER BY name',
      [siteId]
    );

    const mappedSegs = result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      conditions: row.conditions || [],
      description: row.description,
      enabled: row.enabled,
    }));

    return NextResponse.json(mappedSegs);
  } catch (error) {
    console.error('Error fetching segments:', error);
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
    const { name, conditions, description } = body;

    if (!name || !conditions || !Array.isArray(conditions) || conditions.length === 0) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const pool = getPool();
    const id = crypto.randomUUID();

    const result = await pool.query(
      `INSERT INTO segments (id, site_id, name, conditions, description, enabled, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
       RETURNING *`,
      [id, siteId, name.trim(), JSON.stringify(conditions), description?.trim() || null, true]
    );

    const seg = result.rows[0];
    return NextResponse.json({
      id: seg.id,
      siteId: seg.site_id,
      name: seg.name,
      conditions: seg.conditions,
      description: seg.description,
      enabled: seg.enabled,
      createdAt: seg.created_at,
      updatedAt: seg.updated_at,
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating segment:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
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
    const { id, name, conditions, description, enabled } = body;

    if (!id) {
      return NextResponse.json({ error: 'Missing segment ID' }, { status: 400 });
    }

    const pool = getPool();

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(name.trim());
    }
    if (conditions !== undefined) {
      updates.push(`conditions = $${paramIndex++}`);
      values.push(JSON.stringify(conditions));
    }
    if (description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(description?.trim() || null);
    }
    if (enabled !== undefined) {
      updates.push(`enabled = $${paramIndex++}`);
      values.push(enabled);
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    updates.push(`updated_at = NOW()`);
    values.push(id, siteId);

    const result = await pool.query(
      `UPDATE segments
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex++} AND site_id = $${paramIndex++}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Segment not found' }, { status: 404 });
    }

    const updated = result.rows[0];
    return NextResponse.json({
      id: updated.id,
      siteId: updated.site_id,
      name: updated.name,
      conditions: updated.conditions,
      description: updated.description,
      enabled: updated.enabled,
      createdAt: updated.created_at,
      updatedAt: updated.updated_at,
    });
  } catch (error) {
    console.error('Error updating segment:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { authorized, site } = await verifySiteAccess(params.id);
    if (!authorized || !site) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const siteId = params.id;
    const { searchParams } = new URL(request.url);
    const segmentId = searchParams.get('id');

    if (!segmentId) {
      return NextResponse.json({ error: 'Missing segment ID' }, { status: 400 });
    }

    const pool = getPool();

    await pool.query(
      'UPDATE segments SET enabled = false, updated_at = NOW() WHERE id = $1 AND site_id = $2',
      [segmentId, siteId]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting segment:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

