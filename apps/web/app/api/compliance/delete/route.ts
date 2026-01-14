import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@analytics/db';
import { getCurrentUser } from '@/lib/auth-helpers';

/**
 * GDPR/CCPA Data Deletion
 * DELETE /api/compliance/delete - Delete all user data
 */

export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const pool = getPool();
    
    // Delete user data (cascade will handle related records)
    await pool.query('DELETE FROM users WHERE id = $1', [user.id]);

    return NextResponse.json({ success: true, message: 'User data deleted' });
  } catch (error) {
    console.error('Error deleting user data:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
