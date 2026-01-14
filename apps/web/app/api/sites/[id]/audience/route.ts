import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@analytics/db';
import { verifySiteAccess } from '@/lib/auth-helpers';
import {
  getUniqueMetrics,
  getSessionMetrics,
  getDeviceBreakdown,
  getOSBreakdown,
  getCountryBreakdown,
  getNewVsReturning,
  getEngagementMetrics,
  getBrowserBreakdown,
  getScreenResolutionBreakdown,
  getLanguageBreakdown,
  getConnectionTypeBreakdown,
  getUserFrequencyAnalysis,
  getRecencyAnalysis,
  getTimezoneAnalysis,
} from '@analytics/db/src/queries';
import { FilterConfig, ComparisonConfig } from '@analytics/shared';
import { getComparisonData, compareTimePeriods } from '@analytics/db/src/queries-comparisons';

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

    const pool = getPool();
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

    // Parse comparison config from query params
    let comparisonConfig: ComparisonConfig | null = null;
    const comparisonParam = searchParams.get('comparison');
    if (comparisonParam) {
      try {
        comparisonConfig = JSON.parse(comparisonParam);
      } catch (e) {
        console.error('Error parsing comparison:', e);
      }
    }

    // Fetch current period data with error handling
    const [
      uniqueMetricsResult,
      sessionMetricsResult,
      deviceBreakdownResult,
      osBreakdownResult,
      countryBreakdownResult,
      newVsReturningResult,
      engagementMetricsResult,
      browserBreakdownResult,
      screenResolutionBreakdownResult,
      languageBreakdownResult,
      connectionTypeBreakdownResult,
      frequencyAnalysisResult,
      recencyAnalysisResult,
      timezoneAnalysisResult,
    ] = await Promise.allSettled([
      getUniqueMetrics(siteId, timeRange, filters),
      getSessionMetrics(siteId, timeRange, filters),
      getDeviceBreakdown(siteId, timeRange, filters),
      getOSBreakdown(siteId, timeRange, filters),
      getCountryBreakdown(siteId, timeRange, 15, filters),
      getNewVsReturning(siteId, timeRange),
      getEngagementMetrics(siteId, timeRange, filters),
      getBrowserBreakdown(siteId, timeRange, filters),
      getScreenResolutionBreakdown(siteId, timeRange, filters),
      getLanguageBreakdown(siteId, timeRange, filters),
      getConnectionTypeBreakdown(siteId, timeRange, filters),
      getUserFrequencyAnalysis(siteId, timeRange, filters),
      getRecencyAnalysis(siteId, timeRange, filters),
      getTimezoneAnalysis(siteId, timeRange, filters),
    ]);

    // Extract results or use defaults
    const uniqueMetrics = uniqueMetricsResult.status === 'fulfilled' ? uniqueMetricsResult.value : { uniqueVisitors: 0, uniqueSessions: 0, totalEvents: 0 };
    const sessionMetrics = sessionMetricsResult.status === 'fulfilled' ? sessionMetricsResult.value : { bounceRate: 0, avgDurationSeconds: 0, totalSessions: 0, bouncedSessions: 0 };
    const deviceBreakdown = deviceBreakdownResult.status === 'fulfilled' ? (Array.isArray(deviceBreakdownResult.value) ? deviceBreakdownResult.value : []) : [];
    const osBreakdown = osBreakdownResult.status === 'fulfilled' ? (Array.isArray(osBreakdownResult.value) ? osBreakdownResult.value : []) : [];
    const countryBreakdown = countryBreakdownResult.status === 'fulfilled' ? (Array.isArray(countryBreakdownResult.value) ? countryBreakdownResult.value : []) : [];
    const newVsReturning = newVsReturningResult.status === 'fulfilled' ? newVsReturningResult.value : { new: 0, returning: 0, total: 0, newPercentage: 0, returningPercentage: 0 };
    const engagementMetrics = engagementMetricsResult.status === 'fulfilled' ? engagementMetricsResult.value : { avgPagesPerSession: 0, avgSessionDuration: 0, medianPagesPerSession: 0 };
    const browserBreakdown = browserBreakdownResult.status === 'fulfilled' ? (Array.isArray(browserBreakdownResult.value) ? browserBreakdownResult.value : []) : [];
    const screenResolutionBreakdown = screenResolutionBreakdownResult.status === 'fulfilled' ? (Array.isArray(screenResolutionBreakdownResult.value) ? screenResolutionBreakdownResult.value : []) : [];
    const languageBreakdown = languageBreakdownResult.status === 'fulfilled' ? (Array.isArray(languageBreakdownResult.value) ? languageBreakdownResult.value : []) : [];
    const connectionTypeBreakdown = connectionTypeBreakdownResult.status === 'fulfilled' ? (Array.isArray(connectionTypeBreakdownResult.value) ? connectionTypeBreakdownResult.value : []) : [];
    const frequencyAnalysis = frequencyAnalysisResult.status === 'fulfilled' ? (Array.isArray(frequencyAnalysisResult.value) ? frequencyAnalysisResult.value : []) : [];
    const recencyAnalysis = recencyAnalysisResult.status === 'fulfilled' ? (Array.isArray(recencyAnalysisResult.value) ? recencyAnalysisResult.value : []) : [];
    const timezoneAnalysis = timezoneAnalysisResult.status === 'fulfilled' ? (Array.isArray(timezoneAnalysisResult.value) ? timezoneAnalysisResult.value : []) : [];

    // Log errors for debugging
    if (uniqueMetricsResult.status === 'rejected') console.error('Error fetching unique metrics:', uniqueMetricsResult.reason);
    if (sessionMetricsResult.status === 'rejected') console.error('Error fetching session metrics:', sessionMetricsResult.reason);
    if (deviceBreakdownResult.status === 'rejected') console.error('Error fetching device breakdown:', deviceBreakdownResult.reason);
    if (osBreakdownResult.status === 'rejected') console.error('Error fetching OS breakdown:', osBreakdownResult.reason);
    if (countryBreakdownResult.status === 'rejected') console.error('Error fetching country breakdown:', countryBreakdownResult.reason);
    if (newVsReturningResult.status === 'rejected') console.error('Error fetching new vs returning:', newVsReturningResult.reason);
    if (engagementMetricsResult.status === 'rejected') console.error('Error fetching engagement metrics:', engagementMetricsResult.reason);
    if (browserBreakdownResult.status === 'rejected') console.error('Error fetching browser breakdown:', browserBreakdownResult.reason);
    if (screenResolutionBreakdownResult.status === 'rejected') console.error('Error fetching screen resolution breakdown:', screenResolutionBreakdownResult.reason);
    if (languageBreakdownResult.status === 'rejected') console.error('Error fetching language breakdown:', languageBreakdownResult.reason);
    if (connectionTypeBreakdownResult.status === 'rejected') console.error('Error fetching connection type breakdown:', connectionTypeBreakdownResult.reason);
    if (frequencyAnalysisResult.status === 'rejected') console.error('Error fetching frequency analysis:', frequencyAnalysisResult.reason);
    if (recencyAnalysisResult.status === 'rejected') console.error('Error fetching recency analysis:', recencyAnalysisResult.reason);
    if (timezoneAnalysisResult.status === 'rejected') console.error('Error fetching timezone analysis:', timezoneAnalysisResult.reason);

    // Fetch previous period data for comparison
    const [
      prevUniqueMetricsResult,
      prevSessionMetricsResult,
    ] = await Promise.allSettled([
      getUniqueMetrics(siteId, previousTimeRange),
      getSessionMetrics(siteId, previousTimeRange),
    ]);

    const prevUniqueMetrics = prevUniqueMetricsResult.status === 'fulfilled' ? prevUniqueMetricsResult.value : { uniqueVisitors: 0, uniqueSessions: 0 };
    const prevSessionMetrics = prevSessionMetricsResult.status === 'fulfilled' ? prevSessionMetricsResult.value : { bounceRate: 0, avgDurationSeconds: 0, totalSessions: 0 };

    // Calculate comparisons (use custom comparison if provided, otherwise default to time period)
    let uniqueMetricsComparison: any;
    let sessionMetricsComparison: any;

    if (comparisonConfig && comparisonConfig.type !== 'time_period') {
      // Use custom comparison
      // This would need more sophisticated implementation
      uniqueMetricsComparison = {
        uniqueVisitors: {
          current: uniqueMetrics.uniqueVisitors,
          previous: prevUniqueMetrics.uniqueVisitors,
          change: uniqueMetrics.uniqueVisitors - prevUniqueMetrics.uniqueVisitors,
          changePercent: prevUniqueMetrics.uniqueVisitors > 0
            ? ((uniqueMetrics.uniqueVisitors - prevUniqueMetrics.uniqueVisitors) / prevUniqueMetrics.uniqueVisitors) * 100
            : (uniqueMetrics.uniqueVisitors > 0 ? 100 : 0),
        },
        uniqueSessions: {
          current: uniqueMetrics.uniqueSessions,
          previous: prevUniqueMetrics.uniqueSessions,
          change: uniqueMetrics.uniqueSessions - prevUniqueMetrics.uniqueSessions,
          changePercent: prevUniqueMetrics.uniqueSessions > 0
            ? ((uniqueMetrics.uniqueSessions - prevUniqueMetrics.uniqueSessions) / prevUniqueMetrics.uniqueSessions) * 100
            : (uniqueMetrics.uniqueSessions > 0 ? 100 : 0),
        },
      };
    } else {
      // Default time period comparison
      uniqueMetricsComparison = {
        uniqueVisitors: {
          current: uniqueMetrics.uniqueVisitors,
          previous: prevUniqueMetrics.uniqueVisitors,
          change: uniqueMetrics.uniqueVisitors - prevUniqueMetrics.uniqueVisitors,
          changePercent: prevUniqueMetrics.uniqueVisitors > 0
            ? ((uniqueMetrics.uniqueVisitors - prevUniqueMetrics.uniqueVisitors) / prevUniqueMetrics.uniqueVisitors) * 100
            : (uniqueMetrics.uniqueVisitors > 0 ? 100 : 0),
        },
        uniqueSessions: {
          current: uniqueMetrics.uniqueSessions,
          previous: prevUniqueMetrics.uniqueSessions,
          change: uniqueMetrics.uniqueSessions - prevUniqueMetrics.uniqueSessions,
          changePercent: prevUniqueMetrics.uniqueSessions > 0
            ? ((uniqueMetrics.uniqueSessions - prevUniqueMetrics.uniqueSessions) / prevUniqueMetrics.uniqueSessions) * 100
            : (uniqueMetrics.uniqueSessions > 0 ? 100 : 0),
        },
      };
    }

    sessionMetricsComparison = {
      bounceRate: {
        current: sessionMetrics.bounceRate,
        previous: prevSessionMetrics.bounceRate,
        change: sessionMetrics.bounceRate - prevSessionMetrics.bounceRate,
        changePercent: prevSessionMetrics.bounceRate > 0
          ? ((sessionMetrics.bounceRate - prevSessionMetrics.bounceRate) / prevSessionMetrics.bounceRate) * 100
          : 0,
      },
      avgDurationSeconds: {
        current: sessionMetrics.avgDurationSeconds,
        previous: prevSessionMetrics.avgDurationSeconds,
        change: sessionMetrics.avgDurationSeconds - prevSessionMetrics.avgDurationSeconds,
        changePercent: prevSessionMetrics.avgDurationSeconds > 0
          ? ((sessionMetrics.avgDurationSeconds - prevSessionMetrics.avgDurationSeconds) / prevSessionMetrics.avgDurationSeconds) * 100
          : (sessionMetrics.avgDurationSeconds > 0 ? 100 : 0),
      },
    };

    return NextResponse.json({
      uniqueMetrics,
      sessionMetrics,
      deviceBreakdown: Array.isArray(deviceBreakdown) ? deviceBreakdown : [],
      osBreakdown: Array.isArray(osBreakdown) ? osBreakdown : [],
      countryBreakdown: Array.isArray(countryBreakdown) ? countryBreakdown : [],
      newVsReturning: newVsReturning || { new: 0, returning: 0, total: 0, newPercentage: 0, returningPercentage: 0 },
      engagementMetrics: engagementMetrics || { avgPagesPerSession: 0, avgSessionDuration: 0, medianPagesPerSession: 0 },
      browserBreakdown: Array.isArray(browserBreakdown) ? browserBreakdown : [],
      screenResolutionBreakdown: Array.isArray(screenResolutionBreakdown) ? screenResolutionBreakdown : [],
      languageBreakdown: Array.isArray(languageBreakdown) ? languageBreakdown : [],
      connectionTypeBreakdown: Array.isArray(connectionTypeBreakdown) ? connectionTypeBreakdown : [],
      frequencyAnalysis: Array.isArray(frequencyAnalysis) ? frequencyAnalysis : [],
      recencyAnalysis: Array.isArray(recencyAnalysis) ? recencyAnalysis : [],
      timezoneAnalysis: Array.isArray(timezoneAnalysis) ? timezoneAnalysis : [],
      comparisons: {
        uniqueMetrics: uniqueMetricsComparison,
        sessionMetrics: sessionMetricsComparison,
      },
    });
  } catch (error) {
    console.error('Error fetching audience data:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

