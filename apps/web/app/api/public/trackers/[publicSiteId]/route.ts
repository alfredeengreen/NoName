import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@analytics/db';

// Handle OPTIONS for CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: { publicSiteId: string } }
) {
  try {
    const pool = getPool();
    
    // Find site by publicSiteId
    const siteResult = await pool.query(
      'SELECT * FROM sites WHERE public_site_id = $1 LIMIT 1',
      [params.publicSiteId]
    );
    const site = siteResult.rows;

    if (site.length === 0) {
      return NextResponse.json({ error: 'Site not found' }, { status: 404 });
    }

    const siteId = site[0].id;

    // Get enabled trackers only
    const trackersResult = await pool.query(
      'SELECT event_name, value, css_selector FROM custom_event_trackers WHERE site_id = $1 AND enabled = true',
      [siteId]
    );
    const trackers = trackersResult.rows.map(row => ({
      eventName: row.event_name,
      value: row.value,
      cssSelector: row.css_selector,
    }));

    // Return with CORS headers for public access
    return NextResponse.json(
      { trackers: Array.isArray(trackers) ? trackers : [] },
      {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Cache-Control': 'public, max-age=300', // Cache for 5 minutes
        },
      }
    );
  } catch (error) {
    console.error('Error fetching trackers:', error);
    return NextResponse.json(
      { error: 'Internal server error', trackers: [] },
      {
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
}

