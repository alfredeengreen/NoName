import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@analytics/db';
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

    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const limit = parseInt(searchParams.get('limit') || '100');

    // Default time range: last 7 days
    const fromDate = from ? new Date(from) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const toDate = to ? new Date(to) : new Date();

    const pool = getPool();

    // Get route transitions from pageview events
    const flowsQuery = `
      WITH session_pages AS (
        SELECT 
          sid,
          path,
          ts,
          LAG(path) OVER (PARTITION BY sid ORDER BY ts) as prev_path,
          LAG(ts) OVER (PARTITION BY sid ORDER BY ts) as prev_ts
        FROM events_raw
        WHERE site_id = $1
          AND ts >= $2
          AND ts <= $3
          AND (
            (event_type = 'inc' AND event_name IS NULL)
            OR event_name = 'pageview'
          )
      ),
      transitions AS (
        SELECT 
          COALESCE(prev_path, '/') as from_route,
          path as to_route,
          sid,
          EXTRACT(EPOCH FROM (ts - prev_ts)) * 1000 as transition_time_ms
        FROM session_pages
        WHERE prev_path IS NOT NULL
      ),
      conversion_sessions AS (
        SELECT DISTINCT sid
        FROM events_raw
        WHERE site_id = $1
          AND ts >= $2
          AND ts <= $3
          AND event_type = 'event'
          AND (
            event_name IN ('purchase', 'conversion', 'checkout_complete', 'signup', 'subscribe')
            OR event_name LIKE 'custom:%'
          )
      ),
      exit_sessions AS (
        SELECT DISTINCT sid
        FROM events_raw
        WHERE site_id = $1
          AND ts >= $2
          AND ts <= $3
        EXCEPT
        SELECT sid FROM conversion_sessions
      ),
      flow_aggregates AS (
        SELECT 
          t.from_route,
          t.to_route,
          COUNT(DISTINCT t.sid)::INTEGER as session_count,
          COUNT(DISTINCT CASE WHEN cs.sid IS NOT NULL THEN t.sid END)::INTEGER as conversion_count,
          COUNT(DISTINCT CASE WHEN es.sid IS NOT NULL THEN t.sid END)::INTEGER as exit_count,
          AVG(t.transition_time_ms)::NUMERIC as avg_transition_time
        FROM transitions t
        LEFT JOIN conversion_sessions cs ON cs.sid = t.sid
        LEFT JOIN exit_sessions es ON es.sid = t.sid
        GROUP BY t.from_route, t.to_route
      )
      SELECT 
        from_route,
        to_route,
        session_count,
        conversion_count,
        exit_count,
        avg_transition_time
      FROM flow_aggregates
      ORDER BY session_count DESC
      LIMIT $4
    `;

    const flowsResult = await pool.query(flowsQuery, [site.id, fromDate, toDate, limit]);

    // Group flows by source route for analysis
    const flowsBySource = new Map<string, any[]>();
    for (const flow of flowsResult.rows) {
      const sourceRoute = flow.from_route || '/';
      if (!flowsBySource.has(sourceRoute)) {
        flowsBySource.set(sourceRoute, []);
      }
      flowsBySource.get(sourceRoute)!.push(flow);
    }

    // Transform data for flow visualization
    const flows = Array.from(flowsBySource.entries()).map(([sourceRoute, flowList]) => {
      const totalSessions = flowList.reduce((sum, f) => sum + Number(f.session_count || 0), 0);
      const totalConversions = flowList.reduce((sum, f) => sum + Number(f.conversion_count || 0), 0);
      const totalExits = flowList.reduce((sum, f) => sum + Number(f.exit_count || 0), 0);

      return {
        sourceRoute,
        totalSessions,
        totalConversions,
        totalExits,
        conversionRate: totalSessions > 0 ? totalConversions / totalSessions : 0,
        exitRate: totalSessions > 0 ? totalExits / totalSessions : 0,
        destinations: flowList.map((flow) => ({
          targetRoute: flow.to_route,
          sessionCount: Number(flow.session_count || 0),
          conversionCount: Number(flow.conversion_count || 0),
          exitCount: Number(flow.exit_count || 0),
          avgTransitionTime: flow.avg_transition_time ? Number(flow.avg_transition_time) : undefined,
          conversionRate: Number(flow.session_count || 0) > 0 
            ? Number(flow.conversion_count || 0) / Number(flow.session_count || 0) 
            : 0,
          exitRate: Number(flow.session_count || 0) > 0 
            ? Number(flow.exit_count || 0) / Number(flow.session_count || 0) 
            : 0,
        })),
      };
    });

    // Generate insights
    const insights: any[] = [];

    // Find high-conversion flows
    const highConversionFlows = flows
      .filter((flow) => flow.conversionRate > 0.1) // > 10% conversion
      .sort((a, b) => b.conversionRate - a.conversionRate)
      .slice(0, 5);

    if (highConversionFlows.length > 0) {
      insights.push({
        type: 'high_conversion_flows',
        title: 'High-Converting User Flows',
        description: 'Routes with the highest conversion rates',
        data: highConversionFlows.map((flow) => ({
          route: flow.sourceRoute,
          conversionRate: flow.conversionRate,
          sessionCount: flow.totalSessions,
        })),
      });
    }

    // Find exit-heavy flows
    const highExitFlows = flows
      .filter((flow) => flow.exitRate > 0.3) // > 30% exit rate
      .sort((a, b) => b.exitRate - a.exitRate)
      .slice(0, 5);

    if (highExitFlows.length > 0) {
      insights.push({
        type: 'high_exit_flows',
        title: 'High-Exit User Flows',
        description: 'Routes where users frequently exit',
        data: highExitFlows.map((flow) => ({
          route: flow.sourceRoute,
          exitRate: flow.exitRate,
          sessionCount: flow.totalSessions,
        })),
      });
    }

    // Find bottleneck transitions
    const bottleneckTransitions = flowsResult.rows
      .filter((flow) => flow.avg_transition_time && Number(flow.avg_transition_time) > 30000) // > 30 seconds
      .sort((a, b) => Number(b.avg_transition_time || 0) - Number(a.avg_transition_time || 0))
      .slice(0, 5);

    if (bottleneckTransitions.length > 0) {
      insights.push({
        type: 'bottleneck_transitions',
        title: 'Slow Transitions',
        description: 'Route transitions with long average times',
        data: bottleneckTransitions.map((flow) => ({
          fromRoute: flow.from_route,
          toRoute: flow.to_route,
          avgTransitionTime: Number(flow.avg_transition_time),
          sessionCount: Number(flow.session_count || 0),
        })),
      });
    }

    return NextResponse.json({
      flows,
      insights,
      enabled: true,
      dateRange: {
        from: fromDate.toISOString(),
        to: toDate.toISOString(),
      },
      totalFlows: flows.length,
    });
  } catch (error) {
    console.error('Flows API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch flows data' },
      { status: 500 }
    );
  }
}


