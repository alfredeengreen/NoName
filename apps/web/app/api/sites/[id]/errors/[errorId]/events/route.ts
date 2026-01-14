import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@analytics/db';
import { verifySiteAccess } from '@/lib/auth-helpers';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; errorId: string } }
) {
  try {
    const { authorized, site } = await verifySiteAccess(params.id);
    if (!authorized || !site) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const pool = getPool();

    // Verify error belongs to site
    const errorCheck = await pool.query(
      'SELECT id FROM errors WHERE id = $1 AND site_id = $2',
      [parseInt(params.errorId, 10), site.id]
    );

    if (errorCheck.rows.length === 0) {
      return NextResponse.json({ error: 'Error not found' }, { status: 404 });
    }

    // Get error events
    const eventsResult = await pool.query(
      'SELECT * FROM error_events WHERE error_id = $1 ORDER BY ts DESC LIMIT $2 OFFSET $3',
      [parseInt(params.errorId, 10), limit, offset]
    );
    const events = eventsResult.rows;

    return NextResponse.json({ events });
  } catch (error) {
    console.error('Error fetching error events:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

