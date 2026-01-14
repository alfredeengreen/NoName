import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth-helpers';
import { getPool } from '@analytics/db';
import { nanoid } from 'nanoid';

/**
 * Check if user is admin/owner of any org
 */
async function isAdmin(userId: string): Promise<boolean> {
  const pool = getPool();
  const result = await pool.query(`
    SELECT COUNT(*) as count
    FROM org_members
    WHERE user_id = $1 AND role IN ('owner', 'admin')
    LIMIT 1
  `, [userId]);

  return Number(result.rows[0].count) > 0;
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = await isAdmin(user.id);
    if (!admin) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { email, orgId, role } = await request.json();

    if (!email) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }

    const pool = getPool();

    // Check if user already exists
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE email = $1 LIMIT 1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      return NextResponse.json({ 
        error: 'User with this email already exists' 
      }, { status: 400 });
    }

    // Check if there's already a pending invitation for this email
    const existingInvitation = await pool.query(`
      SELECT id, token, expires_at
      FROM invitations
      WHERE email = $1 AND accepted_at IS NULL AND expires_at > NOW()
      ORDER BY created_at DESC
      LIMIT 1
    `, [email]);

    if (existingInvitation.rows.length > 0) {
      const inv = existingInvitation.rows[0];
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://noname.fyi';
      const invitationUrl = `${baseUrl}/app/invitations/${inv.token}`;
      
      return NextResponse.json({ 
        success: true,
        invitation: {
          id: inv.id,
          token: inv.token,
          email,
          url: invitationUrl,
          expiresAt: inv.expires_at,
          message: 'Pending invitation already exists for this email'
        }
      });
    }

    // Generate invitation token
    const invitationId = nanoid();
    const token = nanoid(32);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    // If orgId is provided, validate it exists
    let finalOrgId = orgId || null;
    let finalRole = role || 'viewer';

    if (orgId) {
      const orgCheck = await pool.query(
        'SELECT id FROM orgs WHERE id = $1 LIMIT 1',
        [orgId]
      );
      if (orgCheck.rows.length === 0) {
        return NextResponse.json({ error: 'Organization not found' }, { status: 400 });
      }
    } else {
      // Create a default org for the new user
      finalOrgId = nanoid();
      finalRole = 'owner'; // They'll be owner of their own org
      await pool.query(
        'INSERT INTO orgs (id, name, created_at) VALUES ($1, $2, NOW())',
        [finalOrgId, `${email.split('@')[0]}'s Organization`]
      );
    }

    // Create invitation
    await pool.query(`
      INSERT INTO invitations (id, org_id, email, role, token, invited_by, expires_at, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
    `, [invitationId, finalOrgId, email, finalRole, token, user.id, expiresAt]);

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://noname.fyi';
    const invitationUrl = `${baseUrl}/app/invitations/${token}`;

    return NextResponse.json({
      success: true,
      invitation: {
        id: invitationId,
        token,
        email,
        url: invitationUrl,
        expiresAt: expiresAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Error creating user invitation:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
