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
      'SELECT * FROM dashboards WHERE site_id = $1 AND enabled = true ORDER BY name',
      [siteId]
    );

    const dashboardsList = result.rows.map(row => ({
      id: row.id,
      siteId: row.site_id,
      name: row.name,
      widgets: row.widgets,
      enabled: row.enabled,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    return NextResponse.json(dashboardsList);
  } catch (error) {
    console.error('Error fetching dashboards:', error);
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
    const { name, widgets } = body;

    if (!name) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const pool = getPool();
    const id = crypto.randomUUID();

    const result = await pool.query(
      `INSERT INTO dashboards (id, site_id, name, widgets, enabled, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
       RETURNING *`,
      [id, siteId, name.trim(), JSON.stringify(widgets || []), true]
    );

    const dashboard = result.rows[0];
    return NextResponse.json({
      id: dashboard.id,
      siteId: dashboard.site_id,
      name: dashboard.name,
      widgets: dashboard.widgets,
      enabled: dashboard.enabled,
      createdAt: dashboard.created_at,
      updatedAt: dashboard.updated_at,
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating dashboard:', error);
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
    const { id, name, widgets, enabled } = body;

    if (!id) {
      return NextResponse.json({ error: 'Missing dashboard ID' }, { status: 400 });
    }

    const pool = getPool();

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(name.trim());
    }
    if (widgets !== undefined) {
      updates.push(`widgets = $${paramIndex++}`);
      values.push(JSON.stringify(widgets));
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
      `UPDATE dashboards
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex++} AND site_id = $${paramIndex++}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Dashboard not found' }, { status: 404 });
    }

    const updated = result.rows[0];
    return NextResponse.json({
      id: updated.id,
      siteId: updated.site_id,
      name: updated.name,
      widgets: updated.widgets,
      enabled: updated.enabled,
      createdAt: updated.created_at,
      updatedAt: updated.updated_at,
    });
  } catch (error) {
    console.error('Error updating dashboard:', error);
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
    const dashboardId = searchParams.get('id');

    if (!dashboardId) {
      return NextResponse.json({ error: 'Missing dashboard ID' }, { status: 400 });
    }

    const pool = getPool();

    await pool.query(
      'UPDATE dashboards SET enabled = false, updated_at = NOW() WHERE id = $1 AND site_id = $2',
      [dashboardId, siteId]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting dashboard:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

