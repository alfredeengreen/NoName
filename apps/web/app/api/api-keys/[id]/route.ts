import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@analytics/db';
import { verifyOrgAccess } from '@/lib/auth-helpers';

/**
 * API Key Management
 * DELETE /api/api-keys/:id - Delete API key
 */

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const orgId = request.headers.get('x-org-id');
    if (!orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { authorized } = await verifyOrgAccess(orgId);
    if (!authorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const pool = getPool();
    await pool.query(
      'DELETE FROM api_keys WHERE id = $1 AND org_id = $2',
      [params.id, orgId]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting API key:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
