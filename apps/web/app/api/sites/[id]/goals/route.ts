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
      'SELECT * FROM goals WHERE site_id = $1 AND enabled = true ORDER BY name',
      [siteId]
    );

    const goalsList = result.rows.map(row => ({
      id: row.id,
      siteId: row.site_id,
      name: row.name,
      type: row.type,
      config: row.config,
      description: row.description,
      enabled: row.enabled,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    return NextResponse.json(Array.isArray(goalsList) ? goalsList : []);
  } catch (error) {
    console.error('Error fetching goals:', error);
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
    const { name, type, config, description } = body;

    if (!name || !type || !config) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!['destination', 'event', 'duration', 'pages'].includes(type)) {
      return NextResponse.json({ error: 'Invalid goal type' }, { status: 400 });
    }

    const pool = getPool();
    const id = crypto.randomUUID();

    const result = await pool.query(
      `INSERT INTO goals (id, site_id, name, type, config, description, enabled, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
       RETURNING *`,
      [id, siteId, name.trim(), type, JSON.stringify(config), description?.trim() || null, true]
    );

    const goal = result.rows[0];
    return NextResponse.json({
      id: goal.id,
      siteId: goal.site_id,
      name: goal.name,
      type: goal.type,
      config: goal.config,
      description: goal.description,
      enabled: goal.enabled,
      createdAt: goal.created_at,
      updatedAt: goal.updated_at,
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating goal:', error);
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
    const { id, name, config, description, enabled } = body;

    if (!id) {
      return NextResponse.json({ error: 'Missing goal ID' }, { status: 400 });
    }

    const pool = getPool();

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(name.trim());
    }
    if (config !== undefined) {
      updates.push(`config = $${paramIndex++}`);
      values.push(JSON.stringify(config));
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
      `UPDATE goals
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex++} AND site_id = $${paramIndex++}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Goal not found' }, { status: 404 });
    }

    const updated = result.rows[0];
    return NextResponse.json({
      id: updated.id,
      siteId: updated.site_id,
      name: updated.name,
      type: updated.type,
      config: updated.config,
      description: updated.description,
      enabled: updated.enabled,
      createdAt: updated.created_at,
      updatedAt: updated.updated_at,
    });
  } catch (error) {
    console.error('Error updating goal:', error);
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
    const goalId = searchParams.get('id');

    if (!goalId) {
      return NextResponse.json({ error: 'Missing goal ID' }, { status: 400 });
    }

    const pool = getPool();

    await pool.query(
      'UPDATE goals SET enabled = false, updated_at = NOW() WHERE id = $1 AND site_id = $2',
      [goalId, siteId]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting goal:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

