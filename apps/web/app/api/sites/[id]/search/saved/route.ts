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

    const siteId = site.id;
    const pool = getPool();

    const result = await pool.query(
      `SELECT * FROM saved_custom_reports 
       WHERE site_id = $1 
       ORDER BY updated_at DESC`,
      [siteId]
    );

    const reports = result.rows.map((row: any) => ({
      id: row.id,
      siteId: row.site_id,
      name: row.name,
      queryText: row.query_text,
      queryConfig: row.query_config,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    return NextResponse.json({ reports });
  } catch (error: any) {
    console.error('Error fetching saved reports:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
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

    const siteId = site.id;
    const searchParams = request.nextUrl.searchParams;
    const reportId = searchParams.get('reportId');

    if (!reportId) {
      return NextResponse.json({ error: 'Report ID is required' }, { status: 400 });
    }

    const pool = getPool();

    await pool.query(
      `DELETE FROM saved_custom_reports 
       WHERE id = $1 AND site_id = $2`,
      [reportId, siteId]
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting saved report:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

