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
    const trackersResult = await pool.query(
      'SELECT * FROM custom_event_trackers WHERE site_id = $1 ORDER BY created_at',
      [siteId]
    );
    const trackers = trackersResult.rows.map(row => ({
      id: row.id,
      siteId: row.site_id,
      eventName: row.event_name,
      value: row.value,
      cssSelector: row.css_selector,
      cssClasses: row.css_classes,
      elementTag: row.element_tag,
      description: row.description,
      enabled: row.enabled,
      createdAt: row.created_at,
    }));

    return NextResponse.json(Array.isArray(trackers) ? trackers : []);
  } catch (error) {
    console.error('Error fetching custom event trackers:', error);
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
    const { eventName, value, cssSelector, cssClasses, elementTag, description } = body;

    if (!eventName || !cssSelector || !cssClasses || !Array.isArray(cssClasses)) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Validate event name (alphanumeric + underscores)
    if (!/^[a-zA-Z0-9_]+$/.test(eventName)) {
      return NextResponse.json({ error: 'Event name must contain only alphanumeric characters and underscores' }, { status: 400 });
    }

    // Validate CSS selector (basic sanitization)
    if (cssSelector.length > 1000) {
      return NextResponse.json({ error: 'CSS selector too long' }, { status: 400 });
    }

    // Validate value if provided
    if (value !== null && value !== undefined) {
      const numValue = typeof value === 'string' ? parseFloat(value) : value;
      if (isNaN(numValue)) {
        return NextResponse.json({ error: 'Value must be a valid number' }, { status: 400 });
      }
    }

    const pool = getPool();
    const id = crypto.randomUUID();

    const result = await pool.query(
      `INSERT INTO custom_event_trackers (id, site_id, event_name, value, css_selector, css_classes, element_tag, description, enabled, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
       RETURNING *`,
      [
        id,
        siteId,
        eventName.trim(),
        value !== null && value !== undefined ? value.toString() : null,
        cssSelector.trim(),
        JSON.stringify(cssClasses),
        elementTag?.trim() || null,
        description?.trim() || null,
        true,
      ]
    );

    const tracker = result.rows[0];
    return NextResponse.json({
      id: tracker.id,
      siteId: tracker.site_id,
      eventName: tracker.event_name,
      value: tracker.value,
      cssSelector: tracker.css_selector,
      cssClasses: tracker.css_classes,
      elementTag: tracker.element_tag,
      description: tracker.description,
      enabled: tracker.enabled,
      createdAt: tracker.created_at,
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating custom event tracker:', error);
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
    const { id, eventName, value, description, enabled } = body;

    if (!id) {
      return NextResponse.json({ error: 'Missing tracker ID' }, { status: 400 });
    }

    const pool = getPool();

    // Build dynamic UPDATE query
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (eventName !== undefined) {
      if (!/^[a-zA-Z0-9_]+$/.test(eventName)) {
        return NextResponse.json({ error: 'Event name must contain only alphanumeric characters and underscores' }, { status: 400 });
      }
      updates.push(`event_name = $${paramIndex++}`);
      values.push(eventName.trim());
    }

    if (value !== undefined) {
      if (value !== null) {
        const numValue = typeof value === 'string' ? parseFloat(value) : value;
        if (isNaN(numValue)) {
          return NextResponse.json({ error: 'Value must be a valid number' }, { status: 400 });
        }
        updates.push(`value = $${paramIndex++}`);
        values.push(numValue.toString());
      } else {
        updates.push(`value = $${paramIndex++}`);
        values.push(null);
      }
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
      `UPDATE custom_event_trackers
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex++} AND site_id = $${paramIndex++}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Tracker not found' }, { status: 404 });
    }

    const updated = result.rows[0];
    return NextResponse.json({
      id: updated.id,
      siteId: updated.site_id,
      eventName: updated.event_name,
      value: updated.value,
      cssSelector: updated.css_selector,
      cssClasses: updated.css_classes,
      elementTag: updated.element_tag,
      description: updated.description,
      enabled: updated.enabled,
      createdAt: updated.created_at,
      updatedAt: updated.updated_at,
    });
  } catch (error) {
    console.error('Error updating custom event tracker:', error);
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
    const trackerId = searchParams.get('id');

    if (!trackerId) {
      return NextResponse.json({ error: 'Missing tracker ID' }, { status: 400 });
    }

    const pool = getPool();

    await pool.query(
      'DELETE FROM custom_event_trackers WHERE id = $1 AND site_id = $2',
      [trackerId, siteId]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting custom event tracker:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

