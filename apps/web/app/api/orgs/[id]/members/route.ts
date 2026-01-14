import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { getCurrentUser } from '@/lib/auth-helpers';
import { getPool } from '@analytics/db';
import { getUserRole, requirePermission } from '@/lib/permissions';
import { hashPassword } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check permission
    const role = await getUserRole(user.id, params.id);
    if (!role || (role !== 'owner' && role !== 'admin')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const pool = getPool();
    const result = await pool.query(`
      SELECT 
        om.user_id,
        om.role,
        om.created_at,
        u.email
      FROM org_members om
      JOIN users u ON om.user_id = u.id
      WHERE om.org_id = $1
      ORDER BY om.created_at DESC
    `, [params.id]);

    const members = result.rows.map((row) => ({
      userId: row.user_id,
      email: row.email,
      role: row.role,
      createdAt: row.created_at,
    }));

    return NextResponse.json({ members });
  } catch (error) {
    console.error('Error fetching org members:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check permission
    const role = await getUserRole(user.id, params.id);
    if (!role || (role !== 'owner' && role !== 'admin')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { email, role: newRole } = await request.json();

    if (!email || !newRole) {
      return NextResponse.json({ error: 'Email and role required' }, { status: 400 });
    }

    // Create invitation
    const pool = getPool();
    const invitationId = crypto.randomUUID();
    const token = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    await pool.query(`
      INSERT INTO invitations (id, org_id, email, role, token, invited_by, expires_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [invitationId, params.id, email, newRole, token, user.id, expiresAt]);

    // TODO: Send invitation email

    return NextResponse.json({ 
      success: true, 
      invitation: { id: invitationId, token } 
    });
  } catch (error) {
    console.error('Error creating invitation:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check permission
    const role = await getUserRole(user.id, params.id);
    if (!role || (role !== 'owner' && role !== 'admin')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { userId, role: newRole } = await request.json();

    if (!userId || !newRole) {
      return NextResponse.json({ error: 'User ID and role required' }, { status: 400 });
    }

    const pool = getPool();
    await pool.query(`
      UPDATE org_members
      SET role = $1
      WHERE org_id = $2 AND user_id = $3
    `, [newRole, params.id, userId]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating member role:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check permission
    const role = await getUserRole(user.id, params.id);
    if (!role || (role !== 'owner' && role !== 'admin')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    // Don't allow removing yourself if you're the only owner
    if (userId === user.id) {
      const pool = getPool();
      const ownerCount = await pool.query(`
        SELECT COUNT(*) as count
        FROM org_members
        WHERE org_id = $1 AND role = 'owner'
      `, [params.id]);

      if (Number(ownerCount.rows[0].count) === 1) {
        return NextResponse.json({ error: 'Cannot remove the only owner' }, { status: 400 });
      }
    }

    const pool = getPool();
    await pool.query(`
      DELETE FROM org_members
      WHERE org_id = $1 AND user_id = $2
    `, [params.id, userId]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing member:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

