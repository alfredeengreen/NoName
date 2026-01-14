import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@analytics/db';
import { verifyPassword } from '@/lib/auth';
import { cookies } from 'next/headers';
import { rateLimit } from '@/lib/rate-limit';

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
    { error: 'Method not allowed. Use POST to login.' },
    { status: 405, headers: { Allow: 'POST, OPTIONS' } }
  );
}

export async function POST(request: NextRequest) {
  // Rate limiting: 5 requests per 15 minutes per IP
  const limit = rateLimit(request, 5, 15 * 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Too many login attempts. Please try again later.' },
      { 
        status: 429,
        headers: {
          'X-RateLimit-Limit': '5',
          'X-RateLimit-Remaining': limit.remaining.toString(),
          'X-RateLimit-Reset': new Date(limit.resetTime).toISOString(),
          'Retry-After': Math.ceil((limit.resetTime - Date.now()) / 1000).toString(),
        }
      }
    );
  }

  try {
    let body;
    try {
      body = await request.json();
    } catch (parseError: any) {
      console.error('Error parsing request body:', parseError);
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
    }

    // Find user using pool query to avoid drizzle-orm version conflicts
    const pool = getPool();
    let userResult;
    try {
      const result = await pool.query('SELECT * FROM users WHERE email = $1 LIMIT 1', [email]);
      userResult = result.rows;
    } catch (dbError: any) {
      console.error('Error querying users:', {
        error: dbError.message,
        code: dbError.code,
        stack: dbError.stack,
      });
      return NextResponse.json({ 
        error: 'Database error. Please try again.' 
      }, { status: 500 });
    }

    if (userResult.length === 0) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const user = userResult[0];

    // Verify password
    let valid;
    try {
      valid = await verifyPassword(password, user.password_hash);
    } catch (verifyError: any) {
      console.error('Error verifying password:', verifyError);
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    if (!valid) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // Create session token
    const sessionToken = crypto.randomUUID();
    const sessionId = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    // Store session in database using raw SQL to avoid Drizzle issues
    const client = await pool.connect();
    try {
      await client.query(`
        INSERT INTO sessions (id, user_id, token, expires_at, created_at)
        VALUES ($1, $2, $3, $4, NOW())
      `, [sessionId, user.id, sessionToken, expiresAt]);
    } catch (sessionError: any) {
      console.error('Error creating session:', {
        error: sessionError.message,
        code: sessionError.code,
        constraint: sessionError.constraint,
      });
      return NextResponse.json({ 
        error: 'Failed to create session. Please try again.' 
      }, { status: 500 });
    } finally {
      client.release();
    }

    // Set cookie on response
    const response = NextResponse.json({ success: true });
    response.cookies.set('session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/', // Use root path so cookie is sent with all requests
    });
    // Add rate limit headers to successful response
    response.headers.set('X-RateLimit-Limit', '5');
    response.headers.set('X-RateLimit-Remaining', limit.remaining.toString());
    response.headers.set('X-RateLimit-Reset', new Date(limit.resetTime).toISOString());
    return response;
  } catch (error: any) {
    console.error('Login error:', {
      error: error.message,
      stack: error.stack,
      code: error.code,
    });
    return NextResponse.json({ 
      error: process.env.NODE_ENV === 'development' 
        ? `Internal server error: ${error.message}`
        : 'Internal server error. Please try again.' 
    }, { status: 500 });
  }
}

