import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@analytics/db';
import {
  getRealtimeUsers,
  getRealtimePages,
  getRealtimeEvents,
  getRealtimeReferrers,
  getRealtimeGeo,
  getRealtimeDevices,
  getLiveActivityFeed,
  getActiveSessions,
  getRealtimeErrorRate,
  getRealtimeConversions,
  getRealtimeUTMCampaigns,
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
    const searchParams = request.nextUrl.searchParams;
    const minutes = parseInt(searchParams.get('minutes') || '30', 10);

    // Fetch all realtime data in parallel
    const [
      activeUsers,
      topPages,
      topEvents,
      topReferrers,
      geoData,
      devices,
      activityFeed,
      activeSessions,
      errorRate,
      conversions,
      utmCampaigns,
    ] = await Promise.all([
      getRealtimeUsers(siteId, minutes),
      getRealtimePages(siteId, minutes, 10),
      getRealtimeEvents(siteId, minutes, 10),
      getRealtimeReferrers(siteId, minutes, 10),
      getRealtimeGeo(siteId, minutes, 10),
      getRealtimeDevices(siteId, minutes),
      getLiveActivityFeed(siteId, Math.min(minutes, 5), 50),
      getActiveSessions(siteId, Math.min(minutes, 5), 20),
      getRealtimeErrorRate(siteId, minutes),
      getRealtimeConversions(siteId, minutes, 20),
      getRealtimeUTMCampaigns(siteId, minutes, 10),
    ]);

    return NextResponse.json({
      activeUsers,
      topPages,
      topEvents,
      topReferrers,
      geoData,
      devices,
      activityFeed: Array.isArray(activityFeed) ? activityFeed : [],
      activeSessions: Array.isArray(activeSessions) ? activeSessions : [],
      errorRate: errorRate || { errorCount: 0, totalEvents: 0, errorRate: 0 },
      conversions: Array.isArray(conversions) ? conversions : [],
      utmCampaigns: Array.isArray(utmCampaigns) ? utmCampaigns : [],
      timeWindow: minutes,
    });
  } catch (error) {
    console.error('Error fetching realtime data:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

