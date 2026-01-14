import { NextResponse } from 'next/server';
import { getPool } from '@analytics/db';

export async function GET() {
  try {
    const pool = getPool();
    const result = await pool.query('SELECT COUNT(*) as count FROM users');
    const userCount = Number(result.rows[0].count);

    return NextResponse.json({ needsOnboarding: userCount === 0 });
  } catch (error) {
    console.error('Error checking onboarding status:', error);
    // If there's an error, assume onboarding is needed (safer for first-time setup)
    return NextResponse.json({ needsOnboarding: true });
  }
}


