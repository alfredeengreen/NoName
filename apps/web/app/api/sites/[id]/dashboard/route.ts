import { NextRequest, NextResponse } from 'next/server';
import { verifySiteAccess } from '@/lib/auth-helpers';
import { getUniqueMetrics, getSessionMetrics, getTrafficSources, getRollupData, getEventCatalog } from '@analytics/db/src/queries';
import { getPool } from '@analytics/db';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { authorized, site } = await verifySiteAccess(params.id);
    if (!authorized || !site) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const start = searchParams.get('start') 
      ? new Date(searchParams.get('start')!) 
      : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const end = searchParams.get('end') 
      ? new Date(searchParams.get('end')!) 
      : new Date();
    const timeRange = { start, end };

    const pool = getPool();

    // Fetch data directly from database in parallel
    const [
      errorsResult,
      frustrationResult,
      conversionsResult,
      insightsResult,
      overviewResult,
    ] = await Promise.allSettled([
      // Errors summary - query directly from events_raw and errors table
      (async () => {
        // Get errors directly from events_raw (most reliable source)
        const rawErrorsResult = await pool.query(
          `SELECT 
            error_type as type,
            error_message as message,
            COUNT(*)::INTEGER as count,
            COUNT(DISTINCT vid)::INTEGER as "affectedUsers"
          FROM events_raw
          WHERE site_id = $1
            AND ts >= $2
            AND ts <= $3
            AND error_type IS NOT NULL
            AND error_message IS NOT NULL
          GROUP BY error_type, error_message
          ORDER BY count DESC
          LIMIT 100`,
          [site.id, start, end]
        );
        
        // Also get errors from errors table that have been seen in the time range
        const errorsResult = await pool.query(
          `SELECT 
            e.id,
            e.fingerprint,
            e.type,
            e.message,
            e.count,
            e.resolved,
            (SELECT COUNT(*)::INTEGER FROM error_events WHERE error_id = e.id AND ts >= $2 AND ts <= $3) as "eventCount",
            (SELECT COUNT(DISTINCT vid)::INTEGER FROM error_events WHERE error_id = e.id AND ts >= $2 AND ts <= $3) as "affectedUsers"
          FROM errors e
          WHERE site_id = $1
            AND last_seen >= $2
            AND last_seen <= $3
          ORDER BY e.last_seen DESC
          LIMIT 100`,
          [site.id, start, end]
        );
        
        // Combine both sources, prioritizing errors table
        const errorsFromTable = (errorsResult.rows || []).map((e: any) => ({
          ...e,
          count: e.eventCount || e.count || 0,
        }));
        const errorsFromRaw = (rawErrorsResult.rows || []).map((e: any) => ({
          id: `raw_${e.type}_${e.message}`.substring(0, 50),
          type: e.type,
          message: e.message,
          count: e.count,
          resolved: false,
          eventCount: e.count,
          affectedUsers: e.affectedUsers,
        }));
        
        // Merge duplicates (prefer errors table entries)
        const errorMap = new Map();
        errorsFromRaw.forEach((e: any) => {
          const key = `${e.type}:${e.message}`;
          if (!errorMap.has(key)) {
            errorMap.set(key, e);
          }
        });
        errorsFromTable.forEach((e: any) => {
          const key = `${e.type}:${e.message}`;
          errorMap.set(key, e);
        });
        
        return { errors: Array.from(errorMap.values()) };
      })(),
      
      // Frustration summary - query directly
      (async () => {
        // Try multiple possible event names for frustration
        const frustrationResult = await pool.query(
          `SELECT 
            CASE 
              WHEN props IS NULL THEN 'unknown'
              WHEN props::text = 'null' THEN 'unknown'
              WHEN props->>'type' IS NULL OR props->>'type' = '' THEN 'unknown'
              ELSE props->>'type'
            END as event_name,
            COUNT(*)::INTEGER as count,
            COUNT(DISTINCT vid)::INTEGER as affected_users
          FROM events_raw
          WHERE site_id = $1
            AND (
              event_name = 'frustration' 
              OR event_name = 'frustration_signal'
              OR (event_type = 'event' AND props->>'frustration' IS NOT NULL)
            )
            AND ts >= $2
            AND ts <= $3
          GROUP BY 
            CASE 
              WHEN props IS NULL THEN 'unknown'
              WHEN props::text = 'null' THEN 'unknown'
              WHEN props->>'type' IS NULL OR props->>'type' = '' THEN 'unknown'
              ELSE props->>'type'
            END
          ORDER BY count DESC`,
          [site.id, start, end]
        );
        
        // If no results, also check for any events with frustration-related props
        if (!frustrationResult.rows || frustrationResult.rows.length === 0) {
          const altFrustrationResult = await pool.query(
            `SELECT 
              'frustration' as event_name,
              COUNT(*)::INTEGER as count,
              COUNT(DISTINCT vid)::INTEGER as affected_users
            FROM events_raw
            WHERE site_id = $1
              AND ts >= $2
              AND ts <= $3
              AND (
                props->>'frustration' IS NOT NULL
                OR props->>'rage_click' IS NOT NULL
                OR props->>'dead_click' IS NOT NULL
                OR props->>'error_click' IS NOT NULL
              )`,
            [site.id, start, end]
          );
          
          if (altFrustrationResult.rows && altFrustrationResult.rows.length > 0) {
            return {
              byType: altFrustrationResult.rows || [],
              topElements: [],
              byPath: [],
            };
          }
        }
        
        return {
          byType: frustrationResult.rows || [],
          topElements: [],
          byPath: [],
        };
      })(),
      
      // Conversions summary - query directly
      (async () => {
        let purchaseEventKey = 'purchase';
        let purchaseResult = await getRollupData(site.id, timeRange, 'purchase').catch(() => []);
        if (!Array.isArray(purchaseResult) || purchaseResult.length === 0) {
          purchaseEventKey = 'custom:purchase';
          purchaseResult = await getRollupData(site.id, timeRange, 'custom:purchase').catch(() => []);
        }
        const totalRevenue = purchaseResult.reduce((sum, p) => sum + (p.valueSum || 0), 0);
        const totalPurchases = purchaseResult.reduce((sum, p) => sum + (p.count || 0), 0);
        
        // Get baseline conversion rate
        const baselineResult = await pool.query(
          `WITH all_sessions AS (
            SELECT DISTINCT sid
            FROM events_raw
            WHERE site_id = $1 AND ts >= $2 AND ts <= $3
          ),
          conversion_sessions AS (
            SELECT DISTINCT sid
            FROM events_raw
            WHERE site_id = $1 AND ts >= $2 AND ts <= $3
              AND event_type = 'event'
              AND (event_name IN ('purchase', 'conversion', 'checkout_complete', 'signup', 'subscribe') OR event_name LIKE 'custom:%')
          )
          SELECT 
            (SELECT COUNT(*)::INTEGER FROM all_sessions) as sessions,
            (SELECT COUNT(*)::INTEGER FROM conversion_sessions) as conversions`,
          [site.id, start, end]
        );
        const baseline = baselineResult.rows[0] || { sessions: 0, conversions: 0 };
        const baselineSessions = Number(baseline.sessions || 0);
        const baselineConversions = Number(baseline.conversions || 0);
        const conversionRate = baselineSessions > 0 ? (baselineConversions / baselineSessions) * 100 : 0;
        
        return {
          ecommerce: {
            revenue: totalRevenue,
            transactions: totalPurchases,
            avgOrderValue: totalPurchases > 0 ? totalRevenue / totalPurchases : 0,
          },
          conversionEvents: [],
          baseline: {
            sessions: baselineSessions,
            conversions: baselineConversions,
            conversionRate: conversionRate / 100,
          },
        };
      })(),
      
      // Insights summary - simplified query
      (async () => {
        const baselineResult = await pool.query(
          `WITH all_sessions AS (
            SELECT DISTINCT sid
            FROM events_raw
            WHERE site_id = $1 AND ts >= $2 AND ts <= $3
          ),
          conversion_sessions AS (
            SELECT DISTINCT sid
            FROM events_raw
            WHERE site_id = $1 AND ts >= $2 AND ts <= $3
              AND event_type = 'event'
              AND (event_name IN ('purchase', 'conversion', 'checkout_complete', 'signup', 'subscribe') OR event_name LIKE 'custom:%')
          ),
          exit_sessions AS (
            SELECT DISTINCT sid
            FROM all_sessions
            WHERE sid NOT IN (SELECT sid FROM conversion_sessions)
          )
          SELECT 
            (SELECT COUNT(*)::INTEGER FROM all_sessions) as sessions,
            (SELECT COUNT(*)::INTEGER FROM conversion_sessions) as conversions,
            (SELECT COUNT(*)::INTEGER FROM exit_sessions) as exits`,
          [site.id, start, end]
        );
        const baseline = baselineResult.rows[0] || { sessions: 0, conversions: 0, exits: 0 };
        const baselineSessions = Number(baseline.sessions || 0);
        const baselineConversions = Number(baseline.conversions || 0);
        const baselineExits = Number(baseline.exits || 0);
        const baselineConvRate = baselineSessions > 0 ? baselineConversions / baselineSessions : 0;
        const baselineExitRate = baselineSessions > 0 ? baselineExits / baselineSessions : 0;
        
        return {
          insights: [],
          baseline: {
            sessions: baselineSessions,
            conversions: baselineConversions,
            conversionRate: baselineConvRate,
            exits: baselineExits,
            exitRate: baselineExitRate,
          },
        };
      })(),
      
      // Overview metrics (visitors, sources)
      Promise.all([
        getUniqueMetrics(site.id, timeRange).catch(() => ({ uniqueVisitors: 0, uniqueSessions: 0, totalEvents: 0 })),
        getSessionMetrics(site.id, timeRange).catch(() => ({ totalSessions: 0, bouncedSessions: 0, bounceRate: 0, avgDurationSeconds: 0 })),
        getTrafficSources(site.id, timeRange).catch(() => ({ referrers: [], utmCampaigns: [] })),
      ]).then(([uniqueMetrics, sessionMetrics, trafficSources]) => ({
        uniqueMetrics,
        sessionMetrics,
        trafficSources,
      })),
    ]);

    // Extract results with defaults
    const errors = errorsResult.status === 'fulfilled' ? errorsResult.value.errors || [] : [];
    const frustration = frustrationResult.status === 'fulfilled' ? frustrationResult.value : { byType: [], topElements: [], byPath: [] };
    const conversions = conversionsResult.status === 'fulfilled' ? conversionsResult.value : { ecommerce: { revenue: 0, transactions: 0, avgOrderValue: 0 }, conversionEvents: [] };
    const insights = insightsResult.status === 'fulfilled' ? insightsResult.value : { insights: [], baseline: { sessions: 0, conversions: 0, conversionRate: 0, exits: 0, exitRate: 0 } };
    const overview = overviewResult.status === 'fulfilled' ? overviewResult.value : { uniqueMetrics: { uniqueVisitors: 0, uniqueSessions: 0, totalEvents: 0 }, sessionMetrics: { totalSessions: 0, bouncedSessions: 0, bounceRate: 0, avgDurationSeconds: 0 }, trafficSources: { referrers: [], utmCampaigns: [] } };

    // Calculate error summary
    const errorSummary = {
      total: errors.length,
      unresolved: errors.filter((e: any) => !e.resolved).length,
      totalOccurrences: errors.reduce((sum: number, e: any) => sum + (e.count || 0), 0),
      affectedUsers: errors.reduce((sum: number, e: any) => sum + (e.affectedUsers || 0), 0),
    };

    // Calculate frustration summary
    const totalFrustrationEvents = frustration.byType.reduce((sum: number, item: any) => sum + (item.count || 0), 0);
    const frustrationSummary = {
      totalEvents: totalFrustrationEvents,
      affectedUsers: frustration.byType.reduce((sum: number, item: any) => sum + (item.affected_users || 0), 0),
      topTypes: frustration.byType.slice(0, 3),
    };

    // Calculate conversions summary
    const conversionRate = (conversions as any).baseline?.conversionRate 
      ? (conversions as any).baseline.conversionRate * 100 
      : (insights.baseline?.conversionRate ? insights.baseline.conversionRate * 100 : 0);
    
    const conversionsSummary = {
      revenue: conversions.ecommerce?.revenue || 0,
      transactions: conversions.ecommerce?.transactions || 0,
      avgOrderValue: conversions.ecommerce?.avgOrderValue || 0,
      conversionRate,
    };

    // Calculate insights summary
    const insightsSummary = {
      activeInsights: insights.insights?.length || 0,
      topRecommendations: insights.insights?.slice(0, 3).flatMap((i: any) => i.recommendations || []).slice(0, 3) || [],
      baseline: insights.baseline || { sessions: 0, conversions: 0, conversionRate: 0, exits: 0, exitRate: 0 },
    };

    // Get top sources (limit to top 5)
    const topSources = {
      referrers: (overview.trafficSources?.referrers || []).slice(0, 5),
      utmCampaigns: (overview.trafficSources?.utmCampaigns || []).slice(0, 5),
    };

    return NextResponse.json({
      errors: errorSummary,
      frustration: frustrationSummary,
      conversions: conversionsSummary,
      insights: insightsSummary,
      visitors: {
        uniqueVisitors: overview.uniqueMetrics?.uniqueVisitors || 0,
        uniqueSessions: overview.uniqueMetrics?.uniqueSessions || 0,
        totalSessions: overview.sessionMetrics?.totalSessions || 0,
        bounceRate: overview.sessionMetrics?.bounceRate || 0,
        avgDuration: overview.sessionMetrics?.avgDurationSeconds || 0,
      },
      topSources,
      timeRange: {
        start: start.toISOString(),
        end: end.toISOString(),
      },
    });
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

