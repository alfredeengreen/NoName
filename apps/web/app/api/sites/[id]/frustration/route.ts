import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@analytics/db';
import { getFrustrationPatterns } from '@analytics/db/src/queries';
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
    const start = searchParams.get('start') ? new Date(searchParams.get('start')!) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const end = searchParams.get('end') ? new Date(searchParams.get('end')!) : new Date();

    const pool = getPool();

    // Get frustration signals by type
    // Frustration events are stored with event_name = 'frustration' and type in props->>'type'
    // Handle both JSONB and text props
    const frustrationResult = await pool.query(
      `
      SELECT 
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
        AND event_name = 'frustration'
        AND ts >= $2
        AND ts <= $3
      GROUP BY 
        CASE 
          WHEN props IS NULL THEN 'unknown'
          WHEN props::text = 'null' THEN 'unknown'
          WHEN props->>'type' IS NULL OR props->>'type' = '' THEN 'unknown'
          ELSE props->>'type'
        END
      ORDER BY count DESC
      `,
      [site.id, start, end]
    );

    // Get top frustrating elements (from props)
    const elementsResult = await pool.query(
      `
      SELECT 
        props->>'selector' as selector,
        COUNT(*)::INTEGER as count
      FROM events_raw
      WHERE site_id = $1
        AND event_name = 'frustration'
        AND props->>'selector' IS NOT NULL
        AND ts >= $2
        AND ts <= $3
      GROUP BY props->>'selector'
      ORDER BY count DESC
      LIMIT 20
      `,
      [site.id, start, end]
    );

    // Get frustration by path
    const pathResult = await pool.query(
      `
      SELECT 
        path,
        COUNT(*)::INTEGER as frustration_count,
        COUNT(DISTINCT vid)::INTEGER as affected_users
      FROM events_raw
      WHERE site_id = $1
        AND event_name = 'frustration'
        AND ts >= $2
        AND ts <= $3
      GROUP BY path
      ORDER BY frustration_count DESC
      LIMIT 20
      `,
      [site.id, start, end]
    );

    const timeRange = { start, end };
    const frustrationPatterns = await getFrustrationPatterns(site.id, timeRange).catch(() => []);

    return NextResponse.json({
      byType: Array.isArray(frustrationResult.rows) ? frustrationResult.rows : [],
      topElements: Array.isArray(elementsResult.rows) ? elementsResult.rows : [],
      byPath: Array.isArray(pathResult.rows) ? pathResult.rows : [],
      patterns: Array.isArray(frustrationPatterns) ? frustrationPatterns : [],
    });
  } catch (error) {
    console.error('Error fetching frustration data:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

