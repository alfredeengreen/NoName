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
    const { searchParams } = new URL(request.url);
    
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const action = searchParams.get('action');

    let query = `
      SELECT *
      FROM audit_log
      WHERE site_id = $1
    `;
    const queryParams: any[] = [siteId];

    if (action) {
      query += ` AND action = $${queryParams.length + 1}`;
      queryParams.push(action);
    }

    query += `
      ORDER BY created_at DESC
      LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}
    `;
    queryParams.push(limit, offset);

    const result = await pool.query(query, queryParams);

    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('Error fetching audit log:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
