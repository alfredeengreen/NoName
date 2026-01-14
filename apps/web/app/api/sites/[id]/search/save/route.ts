import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@analytics/db';
import { verifySiteAccess } from '@/lib/auth-helpers';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { authorized, site } = await verifySiteAccess(params.id);
    if (!authorized || !site) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const siteId = site.id;
    const body = await request.json();
    const { name, queryText, queryConfig } = body;

    if (!name || !queryText || !queryConfig) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const pool = getPool();
    const id = crypto.randomUUID();

    const result = await pool.query(
      `INSERT INTO saved_custom_reports (id, site_id, name, query_text, query_config, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
       RETURNING *`,
      [id, siteId, name.trim(), queryText, JSON.stringify(queryConfig)]
    );

    const report = result.rows[0];
    return NextResponse.json({
      id: report.id,
      siteId: report.site_id,
      name: report.name,
      queryText: report.query_text,
      queryConfig: report.query_config,
      createdAt: report.created_at,
      updatedAt: report.updated_at,
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error saving custom report:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

