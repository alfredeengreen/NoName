import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@analytics/db';
import { getCurrentUser } from '@/lib/auth-helpers';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const siteId = params.id;
    const pool = getPool();

    const result = await pool.query(
      'SELECT * FROM custom_dimensions WHERE site_id = $1 AND enabled = true ORDER BY name',
      [siteId]
    );

    const dims = result.rows.map(row => ({
      id: row.id,
      siteId: row.site_id,
      name: row.name,
      scope: row.scope,
      dataType: row.data_type,
      description: row.description,
      enabled: row.enabled,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    return NextResponse.json(Array.isArray(dims) ? dims : []);
  } catch (error) {
    console.error('Error fetching custom dimensions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const siteId = params.id;
    const body = await request.json();
    const { name, scope, dataType, description } = body;

    if (!name || !scope || !dataType) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!['user', 'session', 'event'].includes(scope)) {
      return NextResponse.json({ error: 'Invalid scope' }, { status: 400 });
    }

    if (!['string', 'number', 'boolean', 'date'].includes(dataType)) {
      return NextResponse.json({ error: 'Invalid data type' }, { status: 400 });
    }

    const pool = getPool();
    const id = crypto.randomUUID();

    const result = await pool.query(
      `INSERT INTO custom_dimensions (id, site_id, name, scope, data_type, description, enabled, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
       RETURNING *`,
      [id, siteId, name.trim(), scope, dataType, description?.trim() || null, true]
    );

    const dim = result.rows[0];
    return NextResponse.json({
      id: dim.id,
      siteId: dim.site_id,
      name: dim.name,
      scope: dim.scope,
      dataType: dim.data_type,
      description: dim.description,
      enabled: dim.enabled,
      createdAt: dim.created_at,
      updatedAt: dim.updated_at,
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating custom dimension:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const siteId = params.id;
    const body = await request.json();
    const { id, name, description, enabled } = body;

    if (!id) {
      return NextResponse.json({ error: 'Missing dimension ID' }, { status: 400 });
    }

    const pool = getPool();

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(name.trim());
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
      `UPDATE custom_dimensions
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex++} AND site_id = $${paramIndex++}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Dimension not found' }, { status: 404 });
    }

    const updated = result.rows[0];
    return NextResponse.json({
      id: updated.id,
      siteId: updated.site_id,
      name: updated.name,
      scope: updated.scope,
      dataType: updated.data_type,
      description: updated.description,
      enabled: updated.enabled,
      createdAt: updated.created_at,
      updatedAt: updated.updated_at,
    });
  } catch (error) {
    console.error('Error updating custom dimension:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const siteId = params.id;
    const { searchParams } = new URL(request.url);
    const dimensionId = searchParams.get('id');

    if (!dimensionId) {
      return NextResponse.json({ error: 'Missing dimension ID' }, { status: 400 });
    }

    const pool = getPool();

    await pool.query(
      'UPDATE custom_dimensions SET enabled = false, updated_at = NOW() WHERE id = $1 AND site_id = $2',
      [dimensionId, siteId]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting custom dimension:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

