import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@analytics/db';
import {
  exploreQuery,
  getAvailableDimensions,
  getAvailableMetrics,
  validateQuery,
} from '@analytics/db/src/queries';
import { verifySiteAccess } from '@/lib/auth-helpers';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { authorized, site } = await verifySiteAccess(params.id);
    if (!authorized || !site) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const siteId = site.id;
    // Return available dimensions and metrics
    const dimensions = await getAvailableDimensions(siteId);
    const metrics = await getAvailableMetrics(siteId);
    
    return NextResponse.json({
      dimensions,
      metrics,
    });
  } catch (error) {
    console.error('Error fetching explore metadata:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { authorized, site } = await verifySiteAccess(params.id);
    if (!authorized || !site) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const siteId = site.id;
    const queryConfig = await request.json();

    // Validate query
    const validation = validateQuery(queryConfig);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.errors.join(', ') }, { status: 400 });
    }

    // Execute query
    const results = await exploreQuery(siteId, queryConfig);

    return NextResponse.json({
      results,
      count: results.length,
    });
  } catch (error: any) {
    console.error('Error executing explore query:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

