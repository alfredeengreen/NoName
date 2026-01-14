import { NextRequest, NextResponse } from 'next/server';
import {
  getTrafficSources,
  getChannelGrouping,
  getUTMTerms,
  getChannelQualityScore,
  getAcquisitionTrends,
  getReferrerQuality,
  getPaidVsOrganic,
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

    // Fetch current and previous period data with error handling
    const [
      trafficSourcesResult,
      channelGroupingResult,
      utmTermsResult,
      prevChannelGroupingResult,
      channelQualityResult,
      acquisitionTrendsResult,
      referrerQualityResult,
      paidVsOrganicResult,
    ] = await Promise.allSettled([
      getTrafficSources(site.id, timeRange, 20, filters),
      getChannelGrouping(site.id, timeRange, filters),
      getUTMTerms(site.id, timeRange, 20, filters),
      getChannelGrouping(site.id, previousTimeRange, filters),
      getChannelQualityScore(site.id, timeRange, filters),
      getAcquisitionTrends(site.id, timeRange, filters),
      getReferrerQuality(site.id, timeRange, 20, filters),
      getPaidVsOrganic(site.id, timeRange, filters),
    ]);

    // Extract results or use defaults
    const trafficSources = trafficSourcesResult.status === 'fulfilled' ? trafficSourcesResult.value : { referrers: [], utmCampaigns: [] };
    const channelGrouping = channelGroupingResult.status === 'fulfilled' ? (Array.isArray(channelGroupingResult.value) ? channelGroupingResult.value : []) : [];
    const utmTerms = utmTermsResult.status === 'fulfilled' ? (Array.isArray(utmTermsResult.value) ? utmTermsResult.value : []) : [];
    const prevChannelGrouping = prevChannelGroupingResult.status === 'fulfilled' ? (Array.isArray(prevChannelGroupingResult.value) ? prevChannelGroupingResult.value : []) : [];
    const channelQuality = channelQualityResult.status === 'fulfilled' ? (Array.isArray(channelQualityResult.value) ? channelQualityResult.value : []) : [];
    const acquisitionTrends = acquisitionTrendsResult.status === 'fulfilled' ? (Array.isArray(acquisitionTrendsResult.value) ? acquisitionTrendsResult.value : []) : [];
    const referrerQuality = referrerQualityResult.status === 'fulfilled' ? (Array.isArray(referrerQualityResult.value) ? referrerQualityResult.value : []) : [];
    const paidVsOrganic = paidVsOrganicResult.status === 'fulfilled' ? (Array.isArray(paidVsOrganicResult.value) ? paidVsOrganicResult.value : []) : [];

    // Log errors for debugging
    if (trafficSourcesResult.status === 'rejected') console.error('Error fetching traffic sources:', trafficSourcesResult.reason);
    if (channelGroupingResult.status === 'rejected') console.error('Error fetching channel grouping:', channelGroupingResult.reason);
    if (utmTermsResult.status === 'rejected') console.error('Error fetching UTM terms:', utmTermsResult.reason);
    if (prevChannelGroupingResult.status === 'rejected') console.error('Error fetching previous channel grouping:', prevChannelGroupingResult.reason);
    if (channelQualityResult.status === 'rejected') console.error('Error fetching channel quality:', channelQualityResult.reason);
    if (acquisitionTrendsResult.status === 'rejected') console.error('Error fetching acquisition trends:', acquisitionTrendsResult.reason);
    if (referrerQualityResult.status === 'rejected') console.error('Error fetching referrer quality:', referrerQualityResult.reason);
    if (paidVsOrganicResult.status === 'rejected') console.error('Error fetching paid vs organic:', paidVsOrganicResult.reason);

    // Calculate total sessions for comparison
    const currentTotalSessions = channelGrouping.reduce((sum, c) => sum + (c.sessions || 0), 0);
    const previousTotalSessions = prevChannelGrouping.reduce((sum, c) => sum + (c.sessions || 0), 0);
    const currentTotalVisitors = channelGrouping.reduce((sum, c) => sum + (c.visitors || 0), 0);
    const previousTotalVisitors = prevChannelGrouping.reduce((sum, c) => sum + (c.visitors || 0), 0);

    return NextResponse.json({
      trafficSources: {
        referrers: Array.isArray(trafficSources.referrers) ? trafficSources.referrers : [],
        utmCampaigns: Array.isArray(trafficSources.utmCampaigns) ? trafficSources.utmCampaigns : [],
      },
      channelGrouping,
      utmTerms,
      channelQuality,
      acquisitionTrends,
      referrerQuality,
      paidVsOrganic,
      comparisons: {
        totalSessions: {
          current: currentTotalSessions,
          previous: previousTotalSessions,
          change: currentTotalSessions - previousTotalSessions,
          changePercent: previousTotalSessions > 0
            ? ((currentTotalSessions - previousTotalSessions) / previousTotalSessions) * 100
            : (currentTotalSessions > 0 ? 100 : 0),
        },
        totalVisitors: {
          current: currentTotalVisitors,
          previous: previousTotalVisitors,
          change: currentTotalVisitors - previousTotalVisitors,
          changePercent: previousTotalVisitors > 0
            ? ((currentTotalVisitors - previousTotalVisitors) / previousTotalVisitors) * 100
            : (currentTotalVisitors > 0 ? 100 : 0),
        },
      },
    });
  } catch (error) {
    console.error('Error fetching acquisition data:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

