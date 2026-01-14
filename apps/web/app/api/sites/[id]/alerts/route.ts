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

    const pool = getPool();
    const siteId = site.id;
    const alertsResult = await pool.query(
      'SELECT * FROM alerts WHERE site_id = $1 AND enabled = true ORDER BY name',
      [siteId]
    );
    const alertsList = alertsResult.rows;

    // Ensure we return an array
    return NextResponse.json(Array.isArray(alertsList) ? alertsList : []);
  } catch (error) {
    console.error('Error fetching alerts:', error);
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

    const pool = getPool();
    const siteId = site.id;
    const body = await request.json();
    const { name, condition, notificationChannels } = body;

    if (!name || !condition || !notificationChannels) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const id = crypto.randomUUID();
    const result = await pool.query(
      `INSERT INTO alerts (id, site_id, name, condition, notification_channels, enabled, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
       RETURNING *`,
      [id, siteId, name.trim(), JSON.stringify(condition), JSON.stringify(notificationChannels), true]
    );

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (error) {
    console.error('Error creating alert:', error);
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

    const pool = getPool();
    const siteId = site.id;
    const body = await request.json();
    const { id, name, condition, notificationChannels, enabled } = body;

    if (!id) {
      return NextResponse.json({ error: 'Missing alert ID' }, { status: 400 });
    }

    const result = await pool.query(
      `UPDATE alerts
       SET name = COALESCE($3, name),
           condition = COALESCE($4::jsonb, condition),
           notification_channels = COALESCE($5::jsonb, notification_channels),
           enabled = COALESCE($6, enabled),
           updated_at = NOW()
       WHERE id = $1 AND site_id = $2
       RETURNING *`,
      [
        id,
        siteId,
        name?.trim() || null,
        condition ? JSON.stringify(condition) : null,
        notificationChannels ? JSON.stringify(notificationChannels) : null,
        enabled !== undefined ? enabled : null,
      ]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Alert not found' }, { status: 404 });
    }

    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating alert:', error);
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

    const pool = getPool();
    const siteId = site.id;
    const { searchParams } = new URL(request.url);
    const alertId = searchParams.get('id');

    if (!alertId) {
      return NextResponse.json({ error: 'Missing alert ID' }, { status: 400 });
    }

    await pool.query(
      'UPDATE alerts SET enabled = false, updated_at = NOW() WHERE id = $1 AND site_id = $2',
      [alertId, siteId]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting alert:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

