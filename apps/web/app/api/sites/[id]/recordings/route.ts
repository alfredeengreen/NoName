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

    const { searchParams } = new URL(request.url);
    const start = searchParams.get('start') ? new Date(searchParams.get('start')!) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const end = searchParams.get('end') ? new Date(searchParams.get('end')!) : new Date();
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const pool = getPool();

    const result = await pool.query(
      `SELECT * FROM session_recordings 
       WHERE site_id = $1 AND start_time >= $2 AND start_time <= $3 
       ORDER BY start_time DESC 
       LIMIT $4`,
      [site.id, start, end, limit]
    );

    return NextResponse.json({ recordings: result.rows });
  } catch (error) {
    console.error('Error fetching recordings:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

