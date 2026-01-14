import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@analytics/db';
import { verifySiteAccess } from '@/lib/auth-helpers';
import {
  wilsonScoreInterval,
  isSignificantDifference,
  calculateFrictionIndex,
} from '@/lib/stats';

interface InsightMetrics {
  n: number;
  p0: number;
  p1: number;
  lift_pp: number;
  lift_ci: [number, number];
  q0: number;
  q1: number;
  exit_delta_pp: number;
  exit_ci: [number, number];
  ctr: number;
  exposure_sessions: number;
  fi: number;
}

interface InsightRecommendation {
  title: string;
  impact_estimate_pp: number;
  effort: number;
  rationale: string;
}

interface InsightExperiment {
  name: string;
  primary_metric: string;
  guardrails: string[];
  success: string;
}

type InsightType =
  | 'driver'
  | 'negative_impact'
  | 'exit_magnet'
  | 'banner_blindness'
  | 'path_bottleneck'
  | 'segment_issue'
  | 'variant_explanation';

interface Insight {
  type: InsightType;
  elementId: string;
  label?: string;
  role?: string;
  metrics: InsightMetrics;
  segment: {
    device?: string;
    route?: string;
    variant?: string;
  };
  priority: number;
  recommendations: InsightRecommendation[];
  experiments: InsightExperiment[];
}

// Helper function to calculate Friction Index
function calculateFrictionIndexForInsight(
  lift: number,
  exitDelta: number,
  hesitationMs?: number,
  rageClicks?: number
): number {
  return calculateFrictionIndex(lift, exitDelta, hesitationMs, rageClicks);
}

// Helper function to classify insight type
function classifyInsightType(
  lift: number,
  exitDelta: number,
  ctr: number,
  exposureSessions: number,
  isSignificant: boolean,
  isExitSignificant: boolean
): InsightType {
  if (lift > 0 && isSignificant) return 'driver';
  if (lift < 0 && isSignificant) return 'negative_impact';
  if (exitDelta > 0 && isExitSignificant) return 'exit_magnet';
  if (ctr < 0.05 && exposureSessions > 100 && lift <= 0) return 'banner_blindness';
  return 'negative_impact'; // Default fallback
}

// Helper function to generate recommendations
function generateRecommendations(
  type: InsightType,
  metrics: InsightMetrics,
  label?: string,
  role?: string
): InsightRecommendation[] {
  const recommendations: InsightRecommendation[] = [];

  switch (type) {
    case 'driver':
      recommendations.push({
        title: 'Strengthen and promote this element',
        impact_estimate_pp: Math.abs(metrics.lift_pp) * 0.8,
        effort: 2,
        rationale: 'Positive conversion lift detected. Amplify this element\'s impact.',
      });
      if (metrics.ctr < 0.1) {
        recommendations.push({
          title: 'Improve visibility and copy',
          impact_estimate_pp: 0.5,
          effort: 1,
          rationale: 'Low CTR despite positive impact. Make it more prominent.',
        });
      }
      break;

    case 'negative_impact':
      recommendations.push({
        title: 'Demote or remove this element',
        impact_estimate_pp: Math.abs(metrics.lift_pp) * 0.6,
        effort: 2,
        rationale: 'Negative conversion impact detected. Consider removing or moving below primary CTA.',
      });
      break;

    case 'exit_magnet':
      recommendations.push({
        title: 'Redesign or relocate this element',
        impact_estimate_pp: Math.abs(metrics.exit_delta_pp) * 0.7,
        effort: 3,
        rationale: 'High exit rate associated with this element. Consider redesigning or moving it.',
      });
      break;

    case 'banner_blindness':
      recommendations.push({
        title: 'Test alternative placement or design',
        impact_estimate_pp: 1.0,
        effort: 2,
        rationale: 'Low engagement suggests banner blindness. Test different designs or placements.',
      });
      break;
  }

  return recommendations;
}

// Helper function to generate experiment suggestions
function generateExperiments(
  type: InsightType,
  elementId: string,
  label?: string
): InsightExperiment[] {
  const experiments: InsightExperiment[] = [];

  switch (type) {
    case 'driver':
      experiments.push({
        name: `Amplify ${label || elementId}`,
        primary_metric: 'conversion_rate',
        guardrails: ['bounce_rate', 'exit_rate'],
        success: 'Conversion rate increases by 5%+',
      });
      break;

    case 'negative_impact':
      experiments.push({
        name: `Remove or Redesign ${label || elementId}`,
        primary_metric: 'conversion_rate',
        guardrails: ['engagement_rate', 'time_on_page'],
        success: 'Conversion rate increases by 3%+',
      });
      break;

    case 'exit_magnet':
      experiments.push({
        name: `Relocate ${label || elementId}`,
        primary_metric: 'exit_rate',
        guardrails: ['conversion_rate', 'engagement_rate'],
        success: 'Exit rate decreases by 10%+',
      });
      break;
  }

  return experiments;
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

    const { searchParams } = new URL(request.url);
    const device = searchParams.get('device');
    const userType = searchParams.get('userType');
    const limit = parseInt(searchParams.get('limit') || '10');
    const minSessions = parseInt(searchParams.get('minSessions') || '1');

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

    const filterSql = filterConditions.join(' AND ');

    // Calculate baseline
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

    // Get element-level metrics (similar to impact API)
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
      ),
      element_exposures AS (
        SELECT 
          element_id,
          COUNT(DISTINCT sid)::INTEGER as exposure_sessions
        FROM element_clicks
        GROUP BY element_id
      )
      SELECT 
        es.element_id,
        COUNT(DISTINCT es.sid)::INTEGER as sessions,
        COUNT(DISTINCT COALESCE(ec.sid, ''))::INTEGER as conversions,
        COUNT(DISTINCT COALESCE(ee.sid, ''))::INTEGER as exits,
        COALESCE(ex.exposure_sessions, 0)::INTEGER as exposure_sessions
      FROM element_sessions es
      LEFT JOIN element_conversions ec ON ec.element_id = es.element_id AND ec.sid = es.sid
      LEFT JOIN element_exits ee ON ee.element_id = es.element_id AND ee.sid = es.sid
      LEFT JOIN element_exposures ex ON ex.element_id = es.element_id
      GROUP BY es.element_id, ex.exposure_sessions
      HAVING COUNT(DISTINCT es.sid) >= $${paramIndex}
      ORDER BY COUNT(DISTINCT es.sid) DESC
      LIMIT $${paramIndex + 1}
    `;

    const elementParams = [...filterParams, minSessions, limit * 2]; // Get more for filtering
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

    // Generate insights
    const insights: Insight[] = elementResult.rows.map((row: any) => {
      const elementId = row.element_id;
      const n = Number(row.sessions || 0);
      const conversions = Number(row.conversions || 0);
      const exits = Number(row.exits || 0);
      const exposureSessions = Number(row.exposure_sessions || n);

      const p0 = baselineConvRate;
      const p1 = n > 0 ? conversions / n : 0;
      const lift_pp = (p1 - p0) * 100; // Convert to percentage points

      const q0 = baselineExitRate;
      const q1 = n > 0 ? exits / n : 0;
      const exit_delta_pp = (q1 - q0) * 100;

      const lift_ci = wilsonScoreInterval(conversions, n).map((v) => v * 100) as [number, number];
      const exit_ci = wilsonScoreInterval(exits, n).map((v) => v * 100) as [number, number];

      const ctr = exposureSessions > 0 ? n / exposureSessions : 0;

      const isSignificant = isSignificantDifference(
        conversions,
        n,
        baselineConversions,
        baselineSessions
      );

      const isExitSignificant = isSignificantDifference(
        exits,
        n,
        baselineExits,
        baselineSessions
      );

      const fi = calculateFrictionIndexForInsight(lift_pp / 100, exit_delta_pp / 100);

      const type = classifyInsightType(
        lift_pp,
        exit_delta_pp,
        ctr,
        exposureSessions,
        isSignificant,
        isExitSignificant
      );

      const metadata = metadataMap.get(elementId) || {};

      const metrics: InsightMetrics = {
        n,
        p0,
        p1,
        lift_pp,
        lift_ci,
        q0,
        q1,
        exit_delta_pp,
        exit_ci,
        ctr,
        exposure_sessions: exposureSessions,
        fi,
      };

      const recommendations = generateRecommendations(type, metrics, metadata.label, metadata.role);
      const experiments = generateExperiments(type, elementId, metadata.label);

      // Calculate priority (higher = more important)
      const priority = Math.abs(lift_pp) * 0.4 + Math.abs(exit_delta_pp) * 0.3 + (isSignificant ? 2 : 0) + (n / 100);

      return {
        type,
        elementId,
        label: metadata.label,
        role: metadata.role,
        metrics,
        segment: {
          device: device || undefined,
        },
        priority,
        recommendations,
        experiments,
      };
    });

    // Sort by priority (highest first)
    insights.sort((a, b) => b.priority - a.priority);

    return NextResponse.json({
      baseline: {
        sessions: baselineSessions,
        conversions: baselineConversions,
        conversionRate: baselineConvRate,
        exits: baselineExits,
        exitRate: baselineExitRate,
      },
      insights: insights.slice(0, limit),
      totalSessions: baselineSessions,
      totalElements: insights.length,
      filters: {
        device: device || undefined,
      },
    });
  } catch (error) {
    console.error('Insights API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch insights' },
      { status: 500 }
    );
  }
}


