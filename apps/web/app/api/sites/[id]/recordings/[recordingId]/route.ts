import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@analytics/db';
import { verifySiteAccess } from '@/lib/auth-helpers';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; recordingId: string } }
) {
  try {
    const { authorized, site } = await verifySiteAccess(params.id);
    if (!authorized || !site) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const pool = getPool();

    const result = await pool.query(
      'SELECT * FROM session_recordings WHERE id = $1 AND site_id = $2 LIMIT 1',
      [params.recordingId, site.id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Recording not found' }, { status: 404 });
    }

    return NextResponse.json({ recording: result.rows[0] });
  } catch (error) {
    console.error('Error fetching recording:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

