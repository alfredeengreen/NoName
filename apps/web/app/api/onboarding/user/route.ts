import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@analytics/db';
import { hashPassword } from '@/lib/auth';
import { nanoid } from 'nanoid';
import { cookies } from 'next/headers';

// Handle OPTIONS for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

// Handle GET requests with proper error
export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed. Use POST to create a user.' },
    { status: 405, headers: { Allow: 'POST, OPTIONS' } }
  );
}

export async function POST(request: NextRequest) {
  try {
    const { email, password, orgName } = await request.json();

    if (!email || !password || !orgName) {
      return NextResponse.json({ error: 'Email, password, and organization name are required' }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
    }

    if (orgName.trim().length === 0) {
      return NextResponse.json({ error: 'Organization name is required' }, { status: 400 });
    }

    if (orgName.length > 255) {
      return NextResponse.json({ error: 'Organization name must be 255 characters or less' }, { status: 400 });
    }

    const pool = getPool();

    // Check if any users exist (should be none during onboarding)
    const existingUsersResult = await pool.query('SELECT * FROM users LIMIT 1');
    if (existingUsersResult.rows.length > 0) {
      return NextResponse.json({ error: 'Onboarding already completed' }, { status: 400 });
    }

    // Check if user with this email exists
    const existingResult = await pool.query('SELECT * FROM users WHERE email = $1 LIMIT 1', [email]);
    if (existingResult.rows.length > 0) {
      return NextResponse.json({ error: 'User already exists' }, { status: 400 });
    }

    // Create user
    const userId = nanoid();
    const passwordHash = await hashPassword(password);

    await pool.query(
      'INSERT INTO users (id, email, password_hash, created_at) VALUES ($1, $2, $3, NOW())',
      [userId, email, passwordHash]
    );

    // Create org with specified name
    const orgId = nanoid();
    await pool.query(
      'INSERT INTO orgs (id, name, created_at) VALUES ($1, $2, NOW())',
      [orgId, orgName.trim()]
    );

    // Add user as owner
    await pool.query(`
      INSERT INTO org_members (org_id, user_id, role, created_at)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (org_id, user_id) DO NOTHING
    `, [orgId, userId, 'owner']);

    // Create session to auto-login user
    const sessionToken = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 days

    await pool.query(
      'INSERT INTO sessions (id, user_id, token, expires_at, created_at) VALUES ($1, $2, $3, $4, NOW())',
      [nanoid(), userId, sessionToken, expiresAt]
    );

    // Set session cookie
    const response = NextResponse.json({ success: true, userId, orgId });
    response.cookies.set('session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });

    return response;
  } catch (error) {
    console.error('Onboarding user creation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

