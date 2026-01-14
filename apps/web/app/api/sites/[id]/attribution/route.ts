import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@analytics/db';
import { getAttributionData, compareAttributionModels, getAttributionPaths, getTimeToConversionFromFirstTouch, getTouchpointFrequency } from '@analytics/db/src/queries-attribution';
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
    const { searchParams } = new URL(request.url);
    const start = searchParams.get('start') ? new Date(searchParams.get('start')!) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = searchParams.get('end') ? new Date(searchParams.get('end')!) : new Date();
    const model = (searchParams.get('model') || 'last_touch') as 'first_touch' | 'last_touch' | 'linear' | 'time_decay' | 'position_based' | 'data_driven';
    const conversionEvent = searchParams.get('event') || undefined;

    const timeRange = { start, end };
    const [
      channels,
      modelComparison,
      attributionPaths,
      timeToConversion,
      touchpointFrequency,
    ] = await Promise.all([
      getAttributionData(siteId, timeRange, model, conversionEvent),
      compareAttributionModels(siteId, timeRange, conversionEvent || 'purchase'),
      getAttributionPaths(siteId, timeRange, conversionEvent || 'purchase', 20),
      getTimeToConversionFromFirstTouch(siteId, timeRange, conversionEvent || 'purchase'),
      getTouchpointFrequency(siteId, timeRange, conversionEvent || 'purchase'),
    ]);

    // Map the data to match frontend expectations
    const mappedChannels = channels.map((ch) => ({
      channel: ch.channel,
      sessions: ch.sessions,
      conversions: ch.conversions,
      revenue: ch.revenue,
      conversionRate: ch.conversionRate,
    }));

    return NextResponse.json({
      model,
      channels: mappedChannels,
      modelComparison: modelComparison || {},
      attributionPaths: Array.isArray(attributionPaths) ? attributionPaths : [],
      timeToConversion: timeToConversion || { avgHours: 0, medianHours: 0, minHours: 0, maxHours: 0 },
      touchpointFrequency: Array.isArray(touchpointFrequency) ? touchpointFrequency : [],
    });
  } catch (error) {
    console.error('Error fetching attribution data:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

