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
    const path = searchParams.get('path') || '/';
    const type = searchParams.get('type') || 'click';
    const start = searchParams.get('start') ? new Date(searchParams.get('start')!) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const end = searchParams.get('end') ? new Date(searchParams.get('end')!) : new Date();

    const pool = getPool();

    // Get aggregated heatmap data
    const result = await pool.query(
      `
      SELECT 
        x,
        y,
        SUM(intensity)::INTEGER as intensity
      FROM heatmap_data
      WHERE site_id = $1
        AND path = $2
        AND type = $3
        AND ts >= $4
        AND ts <= $5
      GROUP BY x, y
      ORDER BY intensity DESC
      `,
      [site.id, path, type, start, end]
    );

    // Get screenshot for this path
    const screenshotResult = await pool.query(
      `
      SELECT screenshot_data, viewport_width, viewport_height
      FROM page_screenshots
      WHERE site_id = $1 AND path = $2
      ORDER BY updated_at DESC
      LIMIT 1
      `,
      [site.id, path]
    );

    const screenshot = screenshotResult.rows[0] || null;

    return NextResponse.json({
      path,
      type,
      points: result.rows.map((r: any) => ({
        x: r.x,
        y: r.y,
        intensity: Number(r.intensity || 0),
      })),
      screenshot: screenshot?.screenshot_data || null,
      viewportWidth: screenshot?.viewport_width || null,
      viewportHeight: screenshot?.viewport_height || null,
    });
  } catch (error) {
    console.error('Error fetching heatmap data:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


