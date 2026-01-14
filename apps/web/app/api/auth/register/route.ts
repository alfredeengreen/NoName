import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@analytics/db';
import { hashPassword } from '@/lib/auth';
import { nanoid } from 'nanoid';
import { rateLimit } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  // Rate limiting: 3 requests per hour per IP (registration should be more restrictive)
  const limit = rateLimit(request, 3, 60 * 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Too many registration attempts. Please try again later.' },
      { 
        status: 429,
        headers: {
          'X-RateLimit-Limit': '3',
          'X-RateLimit-Remaining': limit.remaining.toString(),
          'X-RateLimit-Reset': new Date(limit.resetTime).toISOString(),
          'Retry-After': Math.ceil((limit.resetTime - Date.now()) / 1000).toString(),
        }
      }
    );
  }

  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
    }

    const pool = getPool();

    // Check if user exists using pool query
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

    // Create org for user
    const orgId = nanoid();
    await pool.query(
      'INSERT INTO orgs (id, name, created_at) VALUES ($1, $2, NOW())',
      [orgId, `${email.split('@')[0]}'s Organization`]
    );

    // Add user as owner - use raw SQL to handle created_at column
    try {
      await pool.query(`
        INSERT INTO org_members (org_id, user_id, role, created_at)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (org_id, user_id) DO NOTHING
      `, [orgId, userId, 'owner']);
    } catch (orgMemberError: any) {
      console.error('Error adding user to org:', {
        error: orgMemberError.message,
        code: orgMemberError.code,
      });
      // If this fails, we should rollback, but for now just log it
      // In production, use a transaction
    }

    const response = NextResponse.json({ success: true });
    // Add rate limit headers to successful response
    response.headers.set('X-RateLimit-Limit', '3');
    response.headers.set('X-RateLimit-Remaining', limit.remaining.toString());
    response.headers.set('X-RateLimit-Reset', new Date(limit.resetTime).toISOString());
    return response;
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

