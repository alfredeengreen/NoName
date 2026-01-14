import { NextRequest, NextResponse } from 'next/server';
import {
  getRollupData,
  getEventCatalog,
  getFunnelData,
  getConversionRateTrends,
  getConversionRateByChannel,
  getConversionRateByDevice,
  getTimeToConversion,
} from '@analytics/db/src/queries';
import { FilterConfig } from '@analytics/shared';
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

    // Get time range and filters from URL params
    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get('start')
      ? new Date(searchParams.get('start')!)
      : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const endDate = searchParams.get('end')
      ? new Date(searchParams.get('end')!)
      : new Date();
    const timeRange = { start: startDate, end: endDate };
    const previousTimeRange = getPreviousPeriod(startDate, endDate);
    
    // Parse filters from query params
    let filters: FilterConfig[] = [];
    const filtersParam = searchParams.get('filters');
    if (filtersParam) {
      try {
        filters = JSON.parse(filtersParam);
      } catch (e) {
        console.error('Error parsing filters:', e);
      }
    }

    // Get purchase events (ecommerce) - try both 'purchase' and 'custom:purchase'
    // Try 'purchase' first, then 'custom:purchase' as fallback
    let purchaseEventKey = 'purchase';
    let purchaseResult = await getRollupData(site.id, timeRange, 'purchase').catch(() => []);
    if (!Array.isArray(purchaseResult) || purchaseResult.length === 0) {
      purchaseEventKey = 'custom:purchase';
      purchaseResult = await getRollupData(site.id, timeRange, 'custom:purchase').catch(() => []);
    }
    
    const [purchasesResult, prevPurchasesResult] = await Promise.allSettled([
      Promise.resolve(Array.isArray(purchaseResult) ? purchaseResult : []),
      getRollupData(site.id, previousTimeRange, purchaseEventKey).catch(() => []),
    ]);
    
    // Ensure purchases are arrays
    const safePurchases = purchasesResult.status === 'fulfilled' 
      ? (Array.isArray(purchasesResult.value) ? purchasesResult.value : [])
      : [];
    const safePrevPurchases = prevPurchasesResult.status === 'fulfilled'
      ? (Array.isArray(prevPurchasesResult.value) ? prevPurchasesResult.value : [])
      : [];
    
    if (purchasesResult.status === 'rejected') {
      console.error('Error fetching purchases:', purchasesResult.reason);
    }
    if (prevPurchasesResult.status === 'rejected') {
      console.error('Error fetching previous purchases:', prevPurchasesResult.reason);
    }
    
    // Get all conversion events
    let eventCatalog: Array<{ eventName: string; count: number; lastSeen: Date }> = [];
    try {
      eventCatalog = await getEventCatalog(site.id, 7);
    } catch (error) {
      console.error('Error fetching event catalog:', error);
      eventCatalog = [];
    }
    const safeEventCatalog = Array.isArray(eventCatalog) ? eventCatalog : [];
    // Filter out non-conversion events - exclude pageviews and generic click/form events
    // Keep all custom events and purchase events
    const conversionEvents = safeEventCatalog.filter((e) => {
      const eventName = e.eventName || '';
      // Always include purchase events
      if (eventName === 'purchase' || eventName === 'custom:purchase') {
        return true;
      }
      // Exclude pageviews and generic increment events
      if (eventName === 'pageview' || 
          eventName.startsWith('pv:') ||
          eventName.startsWith('click:') || 
          eventName.startsWith('scroll:') ||
          eventName.startsWith('form_submit:')) {
        return false;
      }
      // Include all other events (custom events)
      return true;
    });

    // Calculate revenue
    const totalRevenue = safePurchases.reduce((sum, p) => sum + (p.valueSum || 0), 0);
    const totalPurchases = safePurchases.reduce((sum, p) => sum + (p.count || 0), 0);
    const prevTotalRevenue = safePrevPurchases.reduce((sum, p) => sum + (p.valueSum || 0), 0);
    const prevTotalPurchases = safePrevPurchases.reduce((sum, p) => sum + (p.count || 0), 0);

    // Don't include hardcoded funnel - let users create funnels on the funnels page
    const safeFunnelData: any[] = [];

    // Get conversion event dynamically - use purchase if available, otherwise use first conversion event
    const conversionEventName = conversionEvents.find(e => 
      e.eventName === 'purchase' || e.eventName === 'custom:purchase'
    )?.eventName || (conversionEvents.length > 0 ? conversionEvents[0].eventName : 'purchase');
    
    // Get additional conversion metrics with error handling - use dynamic conversion event
    const [
      conversionTrendsResult,
      conversionByChannelResult,
      conversionByDeviceResult,
      timeToConversionResult,
    ] = await Promise.allSettled([
      getConversionRateTrends(site.id, timeRange, conversionEventName).catch(() => []),
      getConversionRateByChannel(site.id, timeRange, conversionEventName).catch(() => []),
      getConversionRateByDevice(site.id, timeRange, conversionEventName).catch(() => []),
      getTimeToConversion(site.id, timeRange, conversionEventName).catch(() => ({ avgHours: 0, medianHours: 0, minHours: 0, maxHours: 0 })),
    ]);

    // Extract results or use defaults
    const conversionTrends = conversionTrendsResult.status === 'fulfilled' 
      ? (Array.isArray(conversionTrendsResult.value) ? conversionTrendsResult.value : [])
      : [];
    const conversionByChannel = conversionByChannelResult.status === 'fulfilled'
      ? (Array.isArray(conversionByChannelResult.value) ? conversionByChannelResult.value : [])
      : [];
    const conversionByDevice = conversionByDeviceResult.status === 'fulfilled'
      ? (Array.isArray(conversionByDeviceResult.value) ? conversionByDeviceResult.value : [])
      : [];
    const timeToConversion = timeToConversionResult.status === 'fulfilled'
      ? timeToConversionResult.value
      : { avgHours: 0, medianHours: 0, minHours: 0, maxHours: 0 };

    // Log any errors for debugging
    if (conversionTrendsResult.status === 'rejected') {
      console.error('Error fetching conversion trends:', conversionTrendsResult.reason);
    }
    if (conversionByChannelResult.status === 'rejected') {
      console.error('Error fetching conversion by channel:', conversionByChannelResult.reason);
    }
    if (conversionByDeviceResult.status === 'rejected') {
      console.error('Error fetching conversion by device:', conversionByDeviceResult.reason);
    }
    if (timeToConversionResult.status === 'rejected') {
      console.error('Error fetching time to conversion:', timeToConversionResult.reason);
    }

    return NextResponse.json({
      ecommerce: {
        revenue: totalRevenue,
        transactions: totalPurchases,
        avgOrderValue: totalPurchases > 0 ? totalRevenue / totalPurchases : 0,
      },
      conversionEvents: Array.isArray(conversionEvents) ? conversionEvents : [],
      funnelData: safeFunnelData,
      conversionTrends,
      conversionByChannel,
      conversionByDevice,
      timeToConversion: timeToConversion || { avgHours: 0, medianHours: 0, minHours: 0, maxHours: 0 },
      comparisons: {
        revenue: {
          current: totalRevenue,
          previous: prevTotalRevenue,
          change: totalRevenue - prevTotalRevenue,
          changePercent: prevTotalRevenue > 0
            ? ((totalRevenue - prevTotalRevenue) / prevTotalRevenue) * 100
            : (totalRevenue > 0 ? 100 : 0),
        },
        transactions: {
          current: totalPurchases,
          previous: prevTotalPurchases,
          change: totalPurchases - prevTotalPurchases,
          changePercent: prevTotalPurchases > 0
            ? ((totalPurchases - prevTotalPurchases) / prevTotalPurchases) * 100
            : (totalPurchases > 0 ? 100 : 0),
        },
      },
    });
  } catch (error) {
    console.error('Error fetching conversions data:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

