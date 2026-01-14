import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@analytics/db';
import { verifyOrgAccess } from '@/lib/auth-helpers';

/**
 * User Audit Log
 * GET /api/orgs/:id/audit - Get user audit log
 */

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { authorized } = await verifyOrgAccess(params.id);
    if (!authorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const pool = getPool();
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    let query = `
      SELECT *
      FROM user_audit_log
      WHERE org_id = $1
    `;
    const queryParams: any[] = [params.id];

    if (userId) {
      query += ` AND user_id = $${queryParams.length + 1}`;
      queryParams.push(userId);
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
