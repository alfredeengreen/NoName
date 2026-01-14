import { NextRequest, NextResponse } from 'next/server';
import { verifySiteAccess } from '@/lib/auth-helpers';
import { getPool } from '@analytics/db';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; problemId: string } }
) {
  try {
    const { authorized, site } = await verifySiteAccess(params.id);
    if (!authorized || !site) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // TODO: Implement root cause analysis API call to collector
    // For now, return placeholder
    const pool = getPool();
    const result = await pool.query(
      `
      SELECT 
        p.id,
        p.type,
        p.title,
        p.metadata
      FROM problems p
      WHERE p.id = $1 AND p.site_id = $2
      `,
      [params.problemId, site.id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Problem not found' }, { status: 404 });
    }

    // Return basic analysis (full implementation would call collector service)
    return NextResponse.json({
      rootCause: null,
      causes: [],
      affectedBy: [],
      correlated: [],
    });
  } catch (error) {
    console.error('Error fetching root cause analysis:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
