import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@analytics/db';
import { verifySiteAccess } from '@/lib/auth-helpers';
import {
  wilsonScoreInterval,
  isSignificantDifference,
  isFrictionElement,
} from '@/lib/stats';

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
    const device = searchParams.get('device');
    const userType = searchParams.get('userType');
    const top = parseInt(searchParams.get('top') || '50');
    const minSessions = parseInt(searchParams.get('minSessions') || '10');

    // Default time range: last 7 days
    const endDate = new Date();
    const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const pool = getPool();

    // Build filter conditions
    const filterConditions: string[] = ['site_id = $1', 'ts >= $2', 'ts <= $3'];
    const filterParams: any[] = [site.id, startDate, endDate];
    let paramIndex = 4;

    if (device && device !== 'all') {
      filterConditions.push(`device_category = $${paramIndex}`);
      filterParams.push(device);
      paramIndex++;
    }

    // Note: userType filtering would require custom dimensions or additional tracking
    // For now, we'll skip it or implement based on available data

    const filterSql = filterConditions.join(' AND ');

    // Calculate baseline metrics (all sessions)
    const baselineQuery = `
      WITH all_sessions AS (
        SELECT DISTINCT sid
        FROM events_raw
        WHERE ${filterSql}
      ),
      conversion_sessions AS (
        SELECT DISTINCT sid
        FROM events_raw
        WHERE ${filterSql}
          AND event_type = 'event'
          AND (
            event_name IN ('purchase', 'conversion', 'checkout_complete', 'signup', 'subscribe')
            OR event_name LIKE 'custom:%'
          )
      ),
      exit_sessions AS (
        SELECT DISTINCT sid
        FROM all_sessions
        WHERE sid NOT IN (SELECT sid FROM conversion_sessions)
      )
      SELECT 
        (SELECT COUNT(*)::INTEGER FROM all_sessions) as sessions,
        (SELECT COUNT(*)::INTEGER FROM conversion_sessions) as conversions,
        (SELECT COUNT(*)::INTEGER FROM exit_sessions) as exits
    `;

    const baselineResult = await pool.query(baselineQuery, filterParams);
    const baseline = baselineResult.rows[0] || { sessions: 0, conversions: 0, exits: 0 };
    const baselineSessions = Number(baseline.sessions || 0);
    const baselineConversions = Number(baseline.conversions || 0);
    const baselineExits = Number(baseline.exits || 0);
    const baselineConvRate = baselineSessions > 0 ? baselineConversions / baselineSessions : 0;
    const baselineExitRate = baselineSessions > 0 ? baselineExits / baselineSessions : 0;

    // Get element-level metrics
    // Find all click events with elementId in props
    const elementQuery = `
      WITH element_clicks AS (
        SELECT 
          sid,
          vid,
          props->>'elementId' as element_id,
          props->>'label' as label,
          ts
        FROM events_raw
        WHERE ${filterSql}
          AND event_type = 'event'
          AND event_name = 'click'
          AND props->>'elementId' IS NOT NULL
      ),
      element_sessions AS (
        SELECT DISTINCT
          element_id,
          sid
        FROM element_clicks
      ),
      element_conversions AS (
        SELECT DISTINCT
          ec.element_id,
          ec.sid
        FROM element_clicks ec
        INNER JOIN events_raw e ON e.sid = ec.sid AND e.site_id = $1
        WHERE e.ts >= ec.ts
          AND e.ts <= $3
          AND e.event_type = 'event'
          AND (
            e.event_name IN ('purchase', 'conversion', 'checkout_complete', 'signup', 'subscribe')
            OR e.event_name LIKE 'custom:%'
          )
      ),
      element_exits AS (
        SELECT DISTINCT
          es.element_id,
          es.sid
        FROM element_sessions es
        WHERE es.sid NOT IN (
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
        )
      )
      SELECT 
        es.element_id,
        COUNT(DISTINCT es.sid)::INTEGER as sessions,
        COUNT(DISTINCT COALESCE(ec.sid, ''))::INTEGER as conversions,
        COUNT(DISTINCT COALESCE(ee.sid, ''))::INTEGER as exits
      FROM element_sessions es
      LEFT JOIN element_conversions ec ON ec.element_id = es.element_id AND ec.sid = es.sid
      LEFT JOIN element_exits ee ON ee.element_id = es.element_id AND ee.sid = es.sid
      GROUP BY es.element_id
      HAVING COUNT(DISTINCT es.sid) >= $${paramIndex}
      ORDER BY COUNT(DISTINCT es.sid) DESC
      LIMIT $${paramIndex + 1}
    `;

    const elementParams = [...filterParams, minSessions, top];
    const elementResult = await pool.query(elementQuery, elementParams);

    // Get element metadata
    const elementIds = elementResult.rows.map((r: any) => r.element_id).filter(Boolean);
    let metadataMap = new Map();
    if (elementIds.length > 0) {
      const metadataQuery = `
        SELECT element_id, label, role
        FROM element_metadata
        WHERE site_id = $1 AND element_id = ANY($2)
      `;
      const metadataResult = await pool.query(metadataQuery, [site.id, elementIds]);
      metadataMap = new Map(
        metadataResult.rows.map((r: any) => [r.element_id, { label: r.label, role: r.role }])
      );
    }

    // Calculate impact metrics for each element
    const elementData = elementResult.rows.map((row: any) => {
      const elementId = row.element_id;
      const elSessions = Number(row.sessions || 0);
      const elConversions = Number(row.conversions || 0);
      const elExits = Number(row.exits || 0);

      const pConvGivenClick = elSessions > 0 ? elConversions / elSessions : 0;
      const pExitGivenClick = elSessions > 0 ? elExits / elSessions : 0;
      const convLift = pConvGivenClick - baselineConvRate;
      const exitLift = pExitGivenClick - baselineExitRate;

      // Calculate confidence intervals
      const convCI = wilsonScoreInterval(elConversions, elSessions);
      const exitCI = wilsonScoreInterval(elExits, elSessions);

      // Check statistical significance
      const isSignificant = isSignificantDifference(
        elConversions,
        elSessions,
        baselineConversions,
        baselineSessions
      );

      // Check if element is causing friction
      const isFriction = isFrictionElement(
        elConversions,
        elSessions,
        elExits,
        baselineConversions,
        baselineSessions,
        baselineExits,
        minSessions
      );

      const metadata = metadataMap.get(elementId) || {};

      return {
        elementId,
        label: metadata.label || undefined,
        role: metadata.role || undefined,
        sessions: elSessions,
        conversions: elConversions,
        exits: elExits,
        pConvGivenClick,
        pExitGivenClick,
        baseline: baselineConvRate,
        baselineExit: baselineExitRate,
        lift: convLift,
        exitLift: exitLift,
        confidenceInterval: convCI,
        isSignificant,
        isFriction,
      };
    });

    // Sort by absolute lift (largest effects first)
    elementData.sort((a, b) => Math.abs(b.lift) - Math.abs(a.lift));

    // Get friction elements (negative lift or high exit)
    const frictionElements = elementData
      .filter((el) => el.isFriction)
      .sort((a, b) => b.exitLift - a.exitLift)
      .slice(0, top)
      .map((el) => ({
        elementId: el.elementId,
        label: el.label,
        role: el.role,
        sessions: el.sessions,
        exits: el.exits,
        pExitGivenClick: el.pExitGivenClick,
        baselineExit: el.baselineExit,
        exitLift: el.exitLift,
        conversionDrop: el.lift, // Negative lift = conversion drop
      }));

    return NextResponse.json({
      baseline: {
        sessions: baselineSessions,
        conversions: baselineConversions,
        conversionRate: baselineConvRate,
        exits: baselineExits,
        exitRate: baselineExitRate,
      },
      elements: elementData.slice(0, top),
      frictionElements: frictionElements,
    });
  } catch (error) {
    console.error('Impact API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch impact data' },
      { status: 500 }
    );
  }
}


