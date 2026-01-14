import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@analytics/db';
import { getCurrentUser } from '@/lib/auth-helpers';
import { nanoid } from 'nanoid';

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
      'SELECT * FROM calculated_metrics WHERE site_id = $1 AND enabled = true ORDER BY name',
      [siteId]
    );

    const metrics = result.rows.map(row => ({
      id: row.id,
      siteId: row.site_id,
      name: row.name,
      formula: row.formula,
      description: row.description,
      enabled: row.enabled,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    return NextResponse.json(Array.isArray(metrics) ? metrics : []);
  } catch (error) {
    console.error('Error fetching calculated metrics:', error);
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
    const { name, formula, description } = body;

    if (!name || !formula) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Basic formula validation (should reference valid metrics/dimensions)
    // For MVP, we'll just check it's not empty
    if (formula.trim().length === 0) {
      return NextResponse.json({ error: 'Formula cannot be empty' }, { status: 400 });
    }

    const pool = getPool();
    const id = nanoid();

    const result = await pool.query(
      `INSERT INTO calculated_metrics (id, site_id, name, formula, description, enabled, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
       RETURNING *`,
      [id, siteId, name.trim(), formula.trim(), description?.trim() || null, true]
    );

    const metric = result.rows[0];
    return NextResponse.json({
      id: metric.id,
      siteId: metric.site_id,
      name: metric.name,
      formula: metric.formula,
      description: metric.description,
      enabled: metric.enabled,
      createdAt: metric.created_at,
      updatedAt: metric.updated_at,
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating calculated metric:', error);
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
    const { id, name, formula, description, enabled } = body;

    if (!id) {
      return NextResponse.json({ error: 'Missing metric ID' }, { status: 400 });
    }

    const pool = getPool();

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(name.trim());
    }
    if (formula !== undefined) {
      updates.push(`formula = $${paramIndex++}`);
      values.push(formula.trim());
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
    
    // Add id and siteId to values for WHERE clause
    values.push(id, siteId);
    const whereParam1 = paramIndex;
    const whereParam2 = paramIndex + 1;

    const result = await pool.query(
      `UPDATE calculated_metrics
       SET ${updates.join(', ')}
       WHERE id = $${whereParam1} AND site_id = $${whereParam2}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Metric not found' }, { status: 404 });
    }

    const updated = result.rows[0];
    return NextResponse.json({
      id: updated.id,
      siteId: updated.site_id,
      name: updated.name,
      formula: updated.formula,
      description: updated.description,
      enabled: updated.enabled,
      createdAt: updated.created_at,
      updatedAt: updated.updated_at,
    });
  } catch (error) {
    console.error('Error updating calculated metric:', error);
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
    const metricId = searchParams.get('id');

    if (!metricId) {
      return NextResponse.json({ error: 'Missing metric ID' }, { status: 400 });
    }

    const pool = getPool();

    await pool.query(
      'UPDATE calculated_metrics SET enabled = false, updated_at = NOW() WHERE id = $1 AND site_id = $2',
      [metricId, siteId]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting calculated metric:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

