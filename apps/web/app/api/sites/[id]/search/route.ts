import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@analytics/db';
import { verifySiteAccess } from '@/lib/auth-helpers';
import { parseQuery, parsedToQueryConfig } from '@/lib/query-parser';
import { exploreQuery } from '@analytics/db/src/queries';

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
    const body = await request.json();
    const { query, action } = body;

    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    // Parse the query
    const parsed = parseQuery(query);
    
    // Get time range from query params or use default
    const searchParams = request.nextUrl.searchParams;
    const start = searchParams.get('start') || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const end = searchParams.get('end') || new Date().toISOString();
    const timeRange = {
      start: new Date(start),
      end: new Date(end),
    };

    if (action === 'execute') {
      // Execute the query
      const queryConfig = parsedToQueryConfig(parsed, timeRange, siteId);
      const results = await exploreQuery(siteId, queryConfig);
      
      return NextResponse.json({
        parsed,
        queryConfig,
        results,
        count: results.length,
      });
    } else {
      // Just return the parsed query
      const queryConfig = parsedToQueryConfig(parsed, timeRange, siteId);
      
      return NextResponse.json({
        parsed,
        queryConfig,
      });
    }
  } catch (error: any) {
    console.error('Error processing search query:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

