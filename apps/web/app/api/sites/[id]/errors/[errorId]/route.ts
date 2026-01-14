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

    const pool = getPool();

    // Get error details
    const errorResult = await pool.query(
      'SELECT * FROM errors WHERE id = $1 AND site_id = $2 LIMIT 1',
      [parseInt(params.errorId, 10), site.id]
    );

    if (errorResult.rows.length === 0) {
      return NextResponse.json({ error: 'Error not found' }, { status: 404 });
    }

    // Get recent error events
    const eventsResult = await pool.query(
      'SELECT * FROM error_events WHERE error_id = $1 ORDER BY ts DESC LIMIT 50',
      [parseInt(params.errorId, 10)]
    );
    const events = eventsResult.rows;

    // Get error frequency over time (last 30 days)
    const frequencyResult = await pool.query(
      `
      SELECT 
        DATE(ts) as date,
        COUNT(*)::INTEGER as count
      FROM error_events
      WHERE error_id = $1
        AND ts >= NOW() - INTERVAL '30 days'
      GROUP BY DATE(ts)
      ORDER BY date ASC
      `,
      [parseInt(params.errorId, 10)]
    );

    return NextResponse.json({
      error: errorResult.rows[0],
      events: events,
      frequency: frequencyResult.rows,
    });
  } catch (error) {
    console.error('Error fetching error details:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

