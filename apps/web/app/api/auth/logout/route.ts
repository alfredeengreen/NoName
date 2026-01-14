import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getPool } from '@analytics/db';

export async function POST(request: NextRequest) {
  try {
    const sessionCookie = cookies().get('session');
    
    if (sessionCookie) {
      // Delete session from database
      const pool = getPool();
      try {
        await pool.query(
          'DELETE FROM sessions WHERE token = $1',
          [sessionCookie.value]
        );
      } catch (error) {
        // Ignore errors - session might not exist
        console.error('Error deleting session:', error);
      }
    }

    // Clear the cookie on response
    const response = NextResponse.json({ success: true });
    response.cookies.delete('session');
    response.cookies.set('session', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0,
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Logout error:', error);
    // Still try to clear the cookie even if there's an error
    const response = NextResponse.json({ success: true });
    response.cookies.delete('session');
    response.cookies.set('session', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0,
      path: '/',
    });
    return response;
  }
}

