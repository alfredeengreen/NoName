import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { getCurrentUser } from '@/lib/auth-helpers';
import { getPool } from '@analytics/db';
import { invitations, orgMembers, users, orgs } from '@analytics/db';
import { hashPassword } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json({ error: 'Token required' }, { status: 400 });
    }

    const pool = getPool();
    const result = await pool.query(`
      SELECT 
        i.id,
        i.org_id,
        i.email,
        i.role,
        i.expires_at,
        i.accepted_at,
        o.name as org_name
      FROM invitations i
      LEFT JOIN orgs o ON i.org_id = o.id
      WHERE i.token = $1
      LIMIT 1
    `, [token]);

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
    }

    const invitation = result.rows[0];

    if (new Date(invitation.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Invitation expired' }, { status: 400 });
    }

    if (invitation.accepted_at) {
      return NextResponse.json({ error: 'Invitation already accepted' }, { status: 400 });
    }

    return NextResponse.json({ invitation });
  } catch (error) {
    console.error('Error fetching invitation:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { token, password } = await request.json();

    if (!token || !password) {
      return NextResponse.json({ error: 'Token and password required' }, { status: 400 });
    }

    const pool = getPool();

    // Get invitation
    const invResult = await pool.query(`
      SELECT *
      FROM invitations
      WHERE token = $1
      LIMIT 1
    `, [token]);

    if (invResult.rows.length === 0) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
    }

    const invitation = invResult.rows[0];

    if (new Date(invitation.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Invitation expired' }, { status: 400 });
    }

    if (invitation.accepted_at) {
      return NextResponse.json({ error: 'Invitation already accepted' }, { status: 400 });
    }

    // Check if user already exists
    let userId: string;
    const userResult = await pool.query(`
      SELECT id FROM users WHERE email = $1 LIMIT 1
    `, [invitation.email]);

    if (userResult.rows.length > 0) {
      userId = userResult.rows[0].id;
    } else {
      // Create new user
      userId = crypto.randomUUID();
      const passwordHash = await hashPassword(password);
      await pool.query(`
        INSERT INTO users (id, email, password_hash)
        VALUES ($1, $2, $3)
      `, [userId, invitation.email, passwordHash]);
    }

    // Add user to org
    await pool.query(`
      INSERT INTO org_members (org_id, user_id, role)
      VALUES ($1, $2, $3)
      ON CONFLICT DO NOTHING
    `, [invitation.org_id, userId, invitation.role]);

    // Mark invitation as accepted
    await pool.query(`
      UPDATE invitations
      SET accepted_at = NOW()
      WHERE id = $1
    `, [invitation.id]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error accepting invitation:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


