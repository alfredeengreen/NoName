import { NextRequest, NextResponse } from 'next/server';
import { getConversionPaths } from '@analytics/db/src/queries';
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

    const siteId = params.id;
    const { searchParams } = new URL(request.url);
    const start = searchParams.get('start') ? new Date(searchParams.get('start')!) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = searchParams.get('end') ? new Date(searchParams.get('end')!) : new Date();
    const conversionEvent = searchParams.get('event') || 'purchase';
    const limit = parseInt(searchParams.get('limit') || '10', 10);

    const timeRange = { start, end };
    const data = await getConversionPaths(siteId, timeRange, conversionEvent, limit);

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching conversion paths:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

