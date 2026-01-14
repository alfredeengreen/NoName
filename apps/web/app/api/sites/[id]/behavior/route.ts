import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@analytics/db';
import {
  getTopPages,
  getLandingPages,
  getExitPages,
  getUserFlow,
  getPagePerformanceMetrics,
  getScrollDepthDistribution,
  getPageValue,
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

    const siteId = site.id;
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
      topPagesResult,
      landingPagesResult,
      exitPagesResult,
      userFlowResult,
      prevTopPagesResult,
      pagePerformanceResult,
      scrollDepthDistributionResult,
      pageValueResult,
    ] = await Promise.allSettled([
      getTopPages(siteId, timeRange, 50, filters),
      getLandingPages(siteId, timeRange, 20, filters),
      getExitPages(siteId, timeRange, 20, filters),
      getUserFlow(siteId, timeRange, 5),
      getTopPages(siteId, previousTimeRange, 50, filters),
      getPagePerformanceMetrics(siteId, timeRange, 20, filters),
      getScrollDepthDistribution(siteId, timeRange),
      getPageValue(siteId, timeRange, 20),
    ]);

    // Extract results or use defaults
    const topPages = topPagesResult.status === 'fulfilled' ? (Array.isArray(topPagesResult.value) ? topPagesResult.value : []) : [];
    const landingPages = landingPagesResult.status === 'fulfilled' ? (Array.isArray(landingPagesResult.value) ? landingPagesResult.value : []) : [];
    const exitPages = exitPagesResult.status === 'fulfilled' ? (Array.isArray(exitPagesResult.value) ? exitPagesResult.value : []) : [];
    const userFlow = userFlowResult.status === 'fulfilled' ? (Array.isArray(userFlowResult.value) ? userFlowResult.value : []) : [];
    const prevTopPages = prevTopPagesResult.status === 'fulfilled' ? (Array.isArray(prevTopPagesResult.value) ? prevTopPagesResult.value : []) : [];
    const pagePerformance = pagePerformanceResult.status === 'fulfilled' ? (Array.isArray(pagePerformanceResult.value) ? pagePerformanceResult.value : []) : [];
    const scrollDepthDistribution = scrollDepthDistributionResult.status === 'fulfilled' ? (Array.isArray(scrollDepthDistributionResult.value) ? scrollDepthDistributionResult.value : []) : [];
    const pageValue = pageValueResult.status === 'fulfilled' ? (Array.isArray(pageValueResult.value) ? pageValueResult.value : []) : [];

    // Log errors for debugging
    if (topPagesResult.status === 'rejected') console.error('Error fetching top pages:', topPagesResult.reason);
    if (landingPagesResult.status === 'rejected') console.error('Error fetching landing pages:', landingPagesResult.reason);
    if (exitPagesResult.status === 'rejected') console.error('Error fetching exit pages:', exitPagesResult.reason);
    if (userFlowResult.status === 'rejected') console.error('Error fetching user flow:', userFlowResult.reason);
    if (prevTopPagesResult.status === 'rejected') console.error('Error fetching previous top pages:', prevTopPagesResult.reason);
    if (pagePerformanceResult.status === 'rejected') console.error('Error fetching page performance:', pagePerformanceResult.reason);
    if (scrollDepthDistributionResult.status === 'rejected') console.error('Error fetching scroll depth distribution:', scrollDepthDistributionResult.reason);
    if (pageValueResult.status === 'rejected') console.error('Error fetching page value:', pageValueResult.reason);

    // Calculate total pageviews for comparison
    const currentTotalPageviews = topPages.reduce((sum, p) => sum + p.pageviews, 0);
    const previousTotalPageviews = prevTopPages.reduce((sum, p) => sum + p.pageviews, 0);

    return NextResponse.json({
      topPages,
      landingPages,
      exitPages,
      userFlow,
      pagePerformance: Array.isArray(pagePerformance) ? pagePerformance : [],
      scrollDepthDistribution: Array.isArray(scrollDepthDistribution) ? scrollDepthDistribution : [],
      pageValue: Array.isArray(pageValue) ? pageValue : [],
      comparisons: {
        totalPageviews: {
          current: currentTotalPageviews,
          previous: previousTotalPageviews,
          change: currentTotalPageviews - previousTotalPageviews,
          changePercent: previousTotalPageviews > 0
            ? ((currentTotalPageviews - previousTotalPageviews) / previousTotalPageviews) * 100
            : (currentTotalPageviews > 0 ? 100 : 0),
        },
      },
    });
  } catch (error) {
    console.error('Error fetching behavior data:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

