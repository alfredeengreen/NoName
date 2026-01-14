import { NextRequest, NextResponse } from 'next/server';
import { verifySiteAccess } from '@/lib/auth-helpers';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { authorized, site } = await verifySiteAccess(params.id);
    if (!authorized || !site) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { data } = body;

    if (!Array.isArray(data)) {
      return NextResponse.json({ error: 'Data must be an array' }, { status: 400 });
    }

    // Get collector endpoint from env or config
    const collectorEndpoint = process.env.COLLECTOR_ENDPOINT || 'http://localhost:3001';

    // Send to collector import endpoint
    const response = await fetch(`${collectorEndpoint}/import`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        siteId: site.publicSiteId,
        key: site.publicWriteKey,
        data,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      return NextResponse.json(result, { status: response.status });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error importing data:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

