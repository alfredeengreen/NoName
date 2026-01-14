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
    const minSessions = parseInt(searchParams.get('minSessions') || '5');
    const limit = parseInt(searchParams.get('limit') || '20');

    // Default time range: last 7 days
    const endDate = new Date();
    const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const pool = getPool();

    // Get all sessions with click trails and conversion status
    const sessionsQuery = `
      WITH session_clicks AS (
        SELECT 
          sid,
          vid,
          props->>'elementId' as element_id,
          ts,
          ROW_NUMBER() OVER (PARTITION BY sid ORDER BY ts) as click_order
        FROM events_raw
        WHERE site_id = $1
          AND ts >= $2
          AND ts <= $3
          AND event_type = 'event'
          AND event_name = 'click'
          AND props->>'elementId' IS NOT NULL
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
      session_click_trails AS (
        SELECT 
          sc.sid,
          CASE WHEN cs.sid IS NOT NULL THEN true ELSE false END as converted,
          CASE WHEN es.sid IS NOT NULL THEN true ELSE false END as exited,
          array_agg(sc.element_id ORDER BY sc.click_order) FILTER (WHERE sc.element_id IS NOT NULL) as click_trail
        FROM session_clicks sc
        LEFT JOIN conversion_sessions cs ON cs.sid = sc.sid
        LEFT JOIN exit_sessions es ON es.sid = sc.sid
        GROUP BY sc.sid, cs.sid, es.sid
      )
      SELECT 
        sid,
        converted,
        exited,
        click_trail
      FROM session_click_trails
      WHERE click_trail IS NOT NULL AND array_length(click_trail, 1) > 0
    `;

    const sessionsResult = await pool.query(sessionsQuery, [site.id, startDate, endDate]);

    if (sessionsResult.rows.length === 0) {
      return NextResponse.json({
        convertJourney: [],
        exitJourney: [],
        topBottlenecks: [],
        totalElements: 0,
        totalSessions: 0,
      });
    }

    // Analyze click trails to find journey patterns
    const elementStats = new Map<
      string,
      {
        elementId: string;
        convertCount: number;
        exitCount: number;
        totalCount: number;
      }
    >();

    // Process each session's click trail
    for (const session of sessionsResult.rows) {
      if (!session.click_trail || !Array.isArray(session.click_trail)) continue;

      const trail = session.click_trail as string[];
      const isConverting = session.converted;
      const isExiting = session.exited;

      // Count each element in the trail
      for (const elementId of trail) {
        if (!elementStats.has(elementId)) {
          elementStats.set(elementId, {
            elementId,
            convertCount: 0,
            exitCount: 0,
            totalCount: 0,
          });
        }

        const stats = elementStats.get(elementId)!;
        stats.totalCount++;

        if (isConverting) {
          stats.convertCount++;
        } else if (isExiting) {
          stats.exitCount++;
        }
      }
    }

    // Filter elements with minimum session count
    const filteredElements = Array.from(elementStats.values())
      .filter((el) => el.totalCount >= minSessions)
      .sort((a, b) => b.totalCount - a.totalCount)
      .slice(0, limit);

    // Get element metadata for labels and roles
    const elementIds = filteredElements.map((el) => el.elementId);
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

    // Calculate journey data
    const convertJourney: Array<{
      elementId: string;
      label?: string;
      role?: string;
      convertCount: number;
      exitCount: number;
      convertRatio: number;
      exitRatio: number;
      difference: number;
    }> = [];

    const exitJourney: Array<{
      elementId: string;
      label?: string;
      role?: string;
      convertCount: number;
      exitCount: number;
      convertRatio: number;
      exitRatio: number;
      difference: number;
    }> = [];

    for (const element of filteredElements) {
      const meta = metadataMap.get(element.elementId);
      const convertRatio = element.convertCount / element.totalCount;
      const exitRatio = element.exitCount / element.totalCount;
      const difference = convertRatio - exitRatio;

      const journeyItem = {
        elementId: element.elementId,
        label: meta?.label,
        role: meta?.role,
        convertCount: element.convertCount,
        exitCount: element.exitCount,
        convertRatio,
        exitRatio,
        difference,
      };

      if (difference > 0.1) {
        // More converts than exits
        convertJourney.push(journeyItem);
      } else if (difference < -0.1) {
        // More exits than converts
        exitJourney.push(journeyItem);
      }
    }

    // Sort by difference magnitude
    convertJourney.sort((a, b) => b.difference - a.difference);
    exitJourney.sort((a, b) => a.difference - b.difference);

    // Calculate top bottlenecks (elements that appear more in exit journeys)
    const topBottlenecks = exitJourney
      .filter((item) => item.exitRatio > 0.5) // At least 50% exit rate
      .slice(0, 10)
      .map((item) => ({
        elementId: item.elementId,
        label: item.label,
        role: item.role,
        convertFrequency: item.convertRatio,
        exitFrequency: item.exitRatio,
        ratio: item.exitRatio / Math.max(item.convertRatio, 0.01), // Avoid division by zero
        description: `Appears ${(item.exitRatio / Math.max(item.convertRatio, 0.01)).toFixed(1)}× more in exit journeys than convert journeys`,
      }));

    return NextResponse.json({
      convertJourney: convertJourney.slice(0, 10),
      exitJourney: exitJourney.slice(0, 10),
      topBottlenecks,
      totalElements: filteredElements.length,
      totalSessions: sessionsResult.rows.length,
    });
  } catch (error) {
    console.error('Journeys API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch journey data' },
      { status: 500 }
    );
  }
}


