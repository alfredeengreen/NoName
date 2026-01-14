import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@analytics/db';
import { verifySiteAccess } from '@/lib/auth-helpers';

/**
 * REST API v1 - Sites endpoint
 * GET /api/v1/sites - List sites for authenticated user
 */

export async function GET(request: NextRequest) {
  try {
    // TODO: Implement API key authentication
    // For now, this requires web session authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user from session (simplified - would use API key lookup)
    // For now, return error - API keys not yet implemented
    return NextResponse.json({ error: 'API key authentication not yet implemented' }, { status: 501 });
  } catch (error) {
    console.error('Error fetching sites:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
