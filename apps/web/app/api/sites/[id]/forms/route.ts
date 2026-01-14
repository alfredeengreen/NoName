import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@analytics/db';
import { getFormFieldAnalysis, getFormCompletionTime, getFormErrorPatterns } from '@analytics/db/src/queries';
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

    // Get form completion rates
    const completionResult = await pool.query(
      `
      SELECT 
        form_id,
        COUNT(DISTINCT CASE WHEN event_type = 'submit' THEN sid END)::INTEGER as submissions,
        COUNT(DISTINCT CASE WHEN event_type = 'focus' THEN sid END)::INTEGER as started,
        COUNT(DISTINCT CASE WHEN event_type = 'abandon' THEN sid END)::INTEGER as abandoned,
        ROUND(
          COUNT(DISTINCT CASE WHEN event_type = 'submit' THEN sid END)::NUMERIC / 
          NULLIF(COUNT(DISTINCT CASE WHEN event_type = 'focus' THEN sid END), 0)::NUMERIC * 100, 
          2
        ) as completion_rate
      FROM form_analytics
      WHERE site_id = $1
        AND ts >= $2
        AND ts <= $3
      GROUP BY form_id
      ORDER BY submissions DESC
      `,
      [site.id, start, end]
    );

    // Get field-level analytics
    const fieldResult = await pool.query(
      `
      SELECT 
        form_id,
        field_name,
        AVG(time_spent)::INTEGER as avg_time_spent,
        SUM(error_count)::INTEGER as total_errors,
        COUNT(*)::INTEGER as interactions
      FROM form_analytics
      WHERE site_id = $1
        AND ts >= $2
        AND ts <= $3
        AND field_name IS NOT NULL
      GROUP BY form_id, field_name
      ORDER BY total_errors DESC, avg_time_spent DESC
      `,
      [site.id, start, end]
    );

    // Get drop-off points
    const dropoffResult = await pool.query(
      `
      SELECT 
        form_id,
        field_name,
        COUNT(*)::INTEGER as abandon_count
      FROM form_analytics
      WHERE site_id = $1
        AND ts >= $2
        AND ts <= $3
        AND event_type = 'abandon'
        AND field_name IS NOT NULL
      GROUP BY form_id, field_name
      ORDER BY abandon_count DESC
      LIMIT 20
      `,
      [site.id, start, end]
    );

    const timeRange = { start, end };
    const [fieldAnalysis, completionTime, errorPatterns] = await Promise.all([
      getFormFieldAnalysis(site.id, timeRange).catch(() => []),
      getFormCompletionTime(site.id, timeRange).catch(() => []),
      getFormErrorPatterns(site.id, timeRange, undefined, 20).catch(() => []),
    ]);

    return NextResponse.json({
      forms: Array.isArray(completionResult.rows) ? completionResult.rows : [],
      fields: Array.isArray(fieldResult.rows) ? fieldResult.rows : [],
      dropoffs: Array.isArray(dropoffResult.rows) ? dropoffResult.rows : [],
      fieldAnalysis: Array.isArray(fieldAnalysis) ? fieldAnalysis : [],
      completionTime: Array.isArray(completionTime) ? completionTime : [],
      errorPatterns: Array.isArray(errorPatterns) ? errorPatterns : [],
    });
  } catch (error) {
    console.error('Error fetching form analytics:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

