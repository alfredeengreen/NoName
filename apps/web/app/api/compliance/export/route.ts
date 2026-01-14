import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@analytics/db';
import { getCurrentUser } from '@/lib/auth-helpers';

export const dynamic = 'force-dynamic';

/**
 * GDPR/CCPA Data Export
 * GET /api/compliance/export - Export all user data
 */

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const pool = getPool();
    
    // Export all user data
    const userData: any = {
      user: {
        id: user.id,
        email: user.email,
        createdAt: user.createdAt,
      },
      orgs: [] as any[],
      sites: [] as any[],
      events: [] as any[],
    };

    // Get user's orgs
    const orgsResult = await pool.query(
      `
      SELECT o.*, om.role
      FROM org_members om
      JOIN orgs o ON om.org_id = o.id
      WHERE om.user_id = $1
      `,
      [user.id]
    );
    userData.orgs = orgsResult.rows as any[];

    // Get user's sites
    const sitesResult = await pool.query(
      `
      SELECT s.*
      FROM sites s
      JOIN org_members om ON s.org_id = om.org_id
      WHERE om.user_id = $1
      `,
      [user.id]
    );
    userData.sites = sitesResult.rows as any[];

    return NextResponse.json(userData, {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="user_data_export_${user.id}_${Date.now()}.json"`,
      },
    });
  } catch (error) {
    console.error('Error exporting user data:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
