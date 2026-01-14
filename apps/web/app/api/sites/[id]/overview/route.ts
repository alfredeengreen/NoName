import { NextRequest, NextResponse } from 'next/server';
import {
  getRollupData,
  getTopPages,
  getDeviceBreakdown,
  getOSBreakdown,
  getCountryBreakdown,
  getTrafficSources,
  getUniqueMetrics,
  getSessionMetrics,
  getIngestStats,
  getPageMetrics,
  getHourlyPatterns,
  getDailyPatterns,
  getTopReferrersWithQuality,
  getEngagementScore,
  getTrafficQualityScore,
  getGoalProgress,
  getRealtimeUsers,
  getFormSubmitData,
} from '@analytics/db/src/queries';
import { FilterConfig, ComparisonConfig } from '@analytics/shared';
import { verifySiteAccess } from '@/lib/auth-helpers';
import { compareTimePeriods } from '@analytics/db/src/queries-comparisons';
import { getPreviousPeriod } from '@/lib/comparison';

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
    const endDate = searchParams.get('end')
      ? new Date(searchParams.get('end')!)
      : new Date();
    const startDate = searchParams.get('start')
      ? new Date(searchParams.get('start')!)
      : (() => {
          const d = new Date();
          d.setDate(d.getDate() - 7);
          return d;
        })();
    const timeRange = { start: startDate, end: endDate };
    
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

    // Parse comparison config
    let comparisonConfig: ComparisonConfig | null = null;
    const comparisonParam = searchParams.get('comparison');
    if (comparisonParam) {
      try {
        comparisonConfig = JSON.parse(comparisonParam);
      } catch (e) {
        console.error('Error parsing comparison:', e);
      }
    }

    // Calculate previous period for time-based comparisons
    const previousTimeRange = getPreviousPeriod(timeRange.start, timeRange.end);

    // Fetch all metrics in parallel with error handling
    const [
      pageviewsResult,
      clicksResult,
      formSubmitsResult,
      purchasesResult,
      topPagesResult,
      deviceBreakdownResult,
      osBreakdownResult,
      countryBreakdownResult,
      trafficSourcesResult,
      uniqueMetricsResult,
      sessionMetricsResult,
      ingestStatsResult,
      hourlyPatternsResult,
      dailyPatternsResult,
      topReferrersResult,
      engagementScoreResult,
      trafficQualityScoreResult,
      goalProgressResult,
      activeUsersResult,
    ] = await Promise.allSettled([
      getRollupData(site.id, timeRange, 'pv'),
      getRollupData(site.id, timeRange, 'click:cta_signup'),
      getFormSubmitData(site.id, timeRange), // Get all form_submit:* events aggregated
      getRollupData(site.id, timeRange, 'custom:purchase'),
      getTopPages(site.id, timeRange, 10, filters),
      getDeviceBreakdown(site.id, timeRange, filters),
      getOSBreakdown(site.id, timeRange, filters),
      getCountryBreakdown(site.id, timeRange, 10, filters),
      getTrafficSources(site.id, timeRange, 10, filters),
      getUniqueMetrics(site.id, timeRange, filters),
      getSessionMetrics(site.id, timeRange, filters),
      getIngestStats(site.id, 7 * 24 * 60), // Last 7 days
      getHourlyPatterns(site.id, timeRange),
      getDailyPatterns(site.id, timeRange),
      getTopReferrersWithQuality(site.id, timeRange, 5, filters),
      getEngagementScore(site.id, timeRange, filters),
      getTrafficQualityScore(site.id, timeRange, filters),
      getGoalProgress(site.id, timeRange),
      getRealtimeUsers(site.id, 5), // Last 5 minutes
    ]);

    // Extract results or use defaults
    const pageviews = pageviewsResult.status === 'fulfilled' ? (Array.isArray(pageviewsResult.value) ? pageviewsResult.value : []) : [];
    const clicks = clicksResult.status === 'fulfilled' ? (Array.isArray(clicksResult.value) ? clicksResult.value : []) : [];
    const formSubmits = formSubmitsResult.status === 'fulfilled' ? (Array.isArray(formSubmitsResult.value) ? formSubmitsResult.value : []) : [];
    const purchases = purchasesResult.status === 'fulfilled' ? (Array.isArray(purchasesResult.value) ? purchasesResult.value : []) : [];
    const topPages = topPagesResult.status === 'fulfilled' ? (Array.isArray(topPagesResult.value) ? topPagesResult.value : []) : [];
    const deviceBreakdown = deviceBreakdownResult.status === 'fulfilled' ? (Array.isArray(deviceBreakdownResult.value) ? deviceBreakdownResult.value : []) : [];
    const osBreakdown = osBreakdownResult.status === 'fulfilled' ? (Array.isArray(osBreakdownResult.value) ? osBreakdownResult.value : []) : [];
    const countryBreakdown = countryBreakdownResult.status === 'fulfilled' ? (Array.isArray(countryBreakdownResult.value) ? countryBreakdownResult.value : []) : [];
    const trafficSources = trafficSourcesResult.status === 'fulfilled' ? trafficSourcesResult.value : { referrers: [], utmCampaigns: [] };
    const uniqueMetrics = uniqueMetricsResult.status === 'fulfilled' ? uniqueMetricsResult.value : { uniqueVisitors: 0, uniqueSessions: 0, totalEvents: 0 };
    const sessionMetrics = sessionMetricsResult.status === 'fulfilled' ? sessionMetricsResult.value : { totalSessions: 0, bouncedSessions: 0, bounceRate: 0, avgDurationSeconds: 0 };
    const ingestStats = ingestStatsResult.status === 'fulfilled' ? ingestStatsResult.value : { acceptedCount: 0, droppedInvalid: 0, droppedPii: 0, droppedRateLimited: 0, droppedCardinality: 0 };
    const hourlyPatterns = hourlyPatternsResult.status === 'fulfilled' ? (Array.isArray(hourlyPatternsResult.value) ? hourlyPatternsResult.value : []) : [];
    const dailyPatterns = dailyPatternsResult.status === 'fulfilled' ? (Array.isArray(dailyPatternsResult.value) ? dailyPatternsResult.value : []) : [];
    const topReferrers = topReferrersResult.status === 'fulfilled' ? (Array.isArray(topReferrersResult.value) ? topReferrersResult.value : []) : [];
    const engagementScore = engagementScoreResult.status === 'fulfilled' ? engagementScoreResult.value : 0;
    const trafficQualityScore = trafficQualityScoreResult.status === 'fulfilled' ? trafficQualityScoreResult.value : 0;
    const goalProgress = goalProgressResult.status === 'fulfilled' ? (Array.isArray(goalProgressResult.value) ? goalProgressResult.value : []) : [];
    const activeUsers = activeUsersResult.status === 'fulfilled' ? activeUsersResult.value : 0;

    // Log errors for debugging
    if (pageviewsResult.status === 'rejected') console.error('Error fetching pageviews:', pageviewsResult.reason);
    if (clicksResult.status === 'rejected') console.error('Error fetching clicks:', clicksResult.reason);
    if (formSubmitsResult.status === 'rejected') console.error('Error fetching form submits:', formSubmitsResult.reason);
    if (purchasesResult.status === 'rejected') console.error('Error fetching purchases:', purchasesResult.reason);
    if (topPagesResult.status === 'rejected') console.error('Error fetching top pages:', topPagesResult.reason);
    if (deviceBreakdownResult.status === 'rejected') console.error('Error fetching device breakdown:', deviceBreakdownResult.reason);
    if (osBreakdownResult.status === 'rejected') console.error('Error fetching OS breakdown:', osBreakdownResult.reason);
    if (countryBreakdownResult.status === 'rejected') console.error('Error fetching country breakdown:', countryBreakdownResult.reason);
    if (trafficSourcesResult.status === 'rejected') console.error('Error fetching traffic sources:', trafficSourcesResult.reason);
    if (uniqueMetricsResult.status === 'rejected') console.error('Error fetching unique metrics:', uniqueMetricsResult.reason);
    if (sessionMetricsResult.status === 'rejected') console.error('Error fetching session metrics:', sessionMetricsResult.reason);
    if (ingestStatsResult.status === 'rejected') console.error('Error fetching ingest stats:', ingestStatsResult.reason);
    if (hourlyPatternsResult.status === 'rejected') console.error('Error fetching hourly patterns:', hourlyPatternsResult.reason);
    if (dailyPatternsResult.status === 'rejected') console.error('Error fetching daily patterns:', dailyPatternsResult.reason);
    if (topReferrersResult.status === 'rejected') console.error('Error fetching top referrers:', topReferrersResult.reason);
    if (engagementScoreResult.status === 'rejected') console.error('Error fetching engagement score:', engagementScoreResult.reason);
    if (trafficQualityScoreResult.status === 'rejected') console.error('Error fetching traffic quality score:', trafficQualityScoreResult.reason);
    if (goalProgressResult.status === 'rejected') console.error('Error fetching goal progress:', goalProgressResult.reason);
    if (activeUsersResult.status === 'rejected') console.error('Error fetching active users:', activeUsersResult.reason);

    // Ensure all results are arrays (already handled above, but keeping for consistency)
    const safePageviews = pageviews;
    const safeClicks = clicks;
    const safeFormSubmits = formSubmits;
    const safePurchases = purchases;
    const safeTopPages = topPages;
    const safeDeviceBreakdown = deviceBreakdown;
    const safeOsBreakdown = osBreakdown;
    const safeCountryBreakdown = countryBreakdown;
    const safeTrafficSources = trafficSources;

    // Get detailed metrics for each top page
    const pageMetricsDetails = await Promise.all(
      safeTopPages.map((page) => getPageMetrics(site.id, page.path, timeRange))
    );
    
    const topPagesWithDetails = safeTopPages.map((page, idx) => ({
      ...page,
      ...(pageMetricsDetails[idx] || {}),
    }));

    // Calculate comparisons if time period comparison is enabled
    let comparisons: any = {};
    if (comparisonConfig?.type === 'time_period') {
      const [pageviewsComparison, visitorsComparison, sessionsComparison, bounceRateComparison] = await Promise.all([
        compareTimePeriods(site.id, timeRange, async (siteId, tr) => {
          const data = await getRollupData(siteId, tr, 'pv');
          return data.reduce((sum, p) => sum + (p.count || 0), 0);
        }),
        compareTimePeriods(site.id, timeRange, async (siteId, tr) => {
          const data = await getUniqueMetrics(siteId, tr, []);
          return data.uniqueVisitors;
        }),
        compareTimePeriods(site.id, timeRange, async (siteId, tr) => {
          const data = await getUniqueMetrics(siteId, tr, []);
          return data.uniqueSessions;
        }),
        compareTimePeriods(site.id, timeRange, async (siteId, tr) => {
          const data = await getSessionMetrics(siteId, tr, []);
          return data.bounceRate;
        }),
      ]);

      comparisons = {
        pageviews: pageviewsComparison,
        uniqueVisitors: visitorsComparison,
        uniqueSessions: sessionsComparison,
        bounceRate: bounceRateComparison,
      };
    }

    return NextResponse.json({
      // Time series data
      pageviews: safePageviews.map((p) => ({
        time: p.time.toISOString(),
        count: p.count || 0,
      })),
      clicks: safeClicks.map((c) => ({
        time: c.time.toISOString(),
        count: c.count || 0,
      })),
      formSubmits: safeFormSubmits.map((f) => ({
        time: f.time.toISOString(),
        count: f.count || 0,
      })),
      purchases: safePurchases.map((p) => ({
        time: p.time.toISOString(),
        count: p.count || 0,
        value: p.valueSum || null,
      })),
      // Breakdowns
      topPages: topPagesWithDetails,
      deviceBreakdown: safeDeviceBreakdown,
      osBreakdown: safeOsBreakdown,
      countryBreakdown: safeCountryBreakdown,
      trafficSources: safeTrafficSources,
      // Aggregated metrics
      uniqueMetrics,
      sessionMetrics,
      ingestStats,
      // New metrics
      hourlyPatterns,
      dailyPatterns,
      topReferrers,
      engagementScore,
      trafficQualityScore,
      goalProgress,
      activeUsers,
      comparisons,
    });
  } catch (error) {
    console.error('Error fetching overview data:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

