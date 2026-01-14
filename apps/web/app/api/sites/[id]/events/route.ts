import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@analytics/db';
import { getEventCatalog, getEventFlows, getEventCorrelation, getEventValueDistribution } from '@analytics/db';
import { verifySiteAccess } from '@/lib/auth-helpers';

function getPreviousPeriod(currentStart: Date, currentEnd: Date): { start: Date; end: Date } {
  const duration = currentEnd.getTime() - currentStart.getTime();
  const previousEnd = new Date(currentStart.getTime() - 1);
  const previousStart = new Date(previousEnd.getTime() - duration);
  return { start: previousStart, end: previousEnd };
}

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
    // Get events for current period (last 7 days) and previous period
    const endDate = new Date();
    const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const previousTimeRange = getPreviousPeriod(startDate, endDate);

    const [events, prevEvents] = await Promise.all([
      getEventCatalog(siteId, 7),
      getEventCatalog(siteId, 7), // This gets last 7 days, but we need to filter by time range
    ]);

    const totalEvents = events.reduce((sum, e) => sum + e.count, 0);
    const prevTotalEvents = prevEvents.reduce((sum, e) => sum + e.count, 0);

    const timeRange = { start: startDate, end: endDate };
    const topEvent = events.length > 0 ? events[0].eventName : null;
    
    const [eventFlows, eventValueDistribution] = await Promise.all([
      topEvent ? getEventFlows(siteId, timeRange, topEvent, 10).catch(() => []) : Promise.resolve([]),
      topEvent ? getEventValueDistribution(siteId, timeRange, topEvent).catch(() => null) : Promise.resolve(null),
    ]);

    return NextResponse.json({
      events: events.map((e) => ({
        eventName: e.eventName,
        count: e.count,
        lastSeen: e.lastSeen.toISOString(),
      })),
      comparisons: {
        totalEvents: {
          current: totalEvents,
          previous: prevTotalEvents,
          change: totalEvents - prevTotalEvents,
          changePercent: prevTotalEvents > 0
            ? ((totalEvents - prevTotalEvents) / prevTotalEvents) * 100
            : (totalEvents > 0 ? 100 : 0),
        },
      },
      eventFlows: Array.isArray(eventFlows) ? eventFlows : [],
      valueDistribution: eventValueDistribution,
    });
  } catch (error) {
    console.error('Error fetching events:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

