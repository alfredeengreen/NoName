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
      'SELECT * FROM scheduled_reports WHERE site_id = $1 AND enabled = true ORDER BY name',
      [siteId]
    );

    const mappedReports = result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      reportType: row.report_type,
      schedule: row.schedule || { frequency: 'daily', time: '09:00' },
      delivery: row.delivery || [],
      format: row.format || 'pdf',
      enabled: row.enabled,
    }));

    return NextResponse.json(mappedReports);
  } catch (error) {
    console.error('Error fetching scheduled reports:', error);
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
    const { name, reportType, schedule, delivery, format } = body;

    if (!name || !reportType || !schedule || !delivery) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const pool = getPool();
    const id = crypto.randomUUID();

    const result = await pool.query(
      `INSERT INTO scheduled_reports (id, site_id, name, report_type, schedule, delivery, format, enabled, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
       RETURNING *`,
      [id, siteId, name.trim(), reportType, JSON.stringify(schedule), JSON.stringify(delivery), format || 'pdf', true]
    );

    const report = result.rows[0];
    return NextResponse.json({
      id: report.id,
      siteId: report.site_id,
      name: report.name,
      reportType: report.report_type,
      schedule: report.schedule,
      delivery: report.delivery,
      format: report.format,
      enabled: report.enabled,
      createdAt: report.created_at,
      updatedAt: report.updated_at,
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating scheduled report:', error);
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
    const { id, name, schedule, delivery, format, enabled } = body;

    if (!id) {
      return NextResponse.json({ error: 'Missing report ID' }, { status: 400 });
    }

    const pool = getPool();

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(name.trim());
    }
    if (schedule !== undefined) {
      updates.push(`schedule = $${paramIndex++}`);
      values.push(JSON.stringify(schedule));
    }
    if (delivery !== undefined) {
      updates.push(`delivery = $${paramIndex++}`);
      values.push(JSON.stringify(delivery));
    }
    if (format !== undefined) {
      updates.push(`format = $${paramIndex++}`);
      values.push(format);
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
      `UPDATE scheduled_reports
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex++} AND site_id = $${paramIndex++}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    const updated = result.rows[0];
    return NextResponse.json({
      id: updated.id,
      siteId: updated.site_id,
      name: updated.name,
      reportType: updated.report_type,
      schedule: updated.schedule,
      delivery: updated.delivery,
      format: updated.format,
      enabled: updated.enabled,
      createdAt: updated.created_at,
      updatedAt: updated.updated_at,
    });
  } catch (error) {
    console.error('Error updating scheduled report:', error);
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
    const reportId = searchParams.get('id');

    if (!reportId) {
      return NextResponse.json({ error: 'Missing report ID' }, { status: 400 });
    }

    const pool = getPool();

    await pool.query(
      'UPDATE scheduled_reports SET enabled = false, updated_at = NOW() WHERE id = $1 AND site_id = $2',
      [reportId, siteId]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting scheduled report:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

