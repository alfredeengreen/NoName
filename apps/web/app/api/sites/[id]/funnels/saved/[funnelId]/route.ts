import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@analytics/db';
import { verifySiteAccess } from '@/lib/auth-helpers';

// DELETE - Delete a saved funnel
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; funnelId: string } }
) {
  try {
    const { authorized, site } = await verifySiteAccess(params.id);
    if (!authorized || !site) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const pool = getPool();
    await pool.query(
      'DELETE FROM saved_funnels WHERE id = $1 AND site_id = $2',
      [params.funnelId, site.id]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting saved funnel:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


