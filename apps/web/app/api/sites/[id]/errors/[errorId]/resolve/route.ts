import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@analytics/db';
import { verifySiteAccess } from '@/lib/auth-helpers';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; errorId: string } }
) {
  try {
    const { authorized, site } = await verifySiteAccess(params.id);
    if (!authorized || !site) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const pool = getPool();
    const { resolved } = await request.json();

    await pool.query(
      `UPDATE errors 
       SET resolved = $1, resolved_at = $2 
       WHERE id = $3 AND site_id = $4`,
      [
        resolved === true,
        resolved === true ? new Date() : null,
        parseInt(params.errorId, 10),
        site.id,
      ]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating error resolution:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

