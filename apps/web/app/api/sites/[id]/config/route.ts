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

    const pool = getPool();
    
    // Get site config from site_config table
    const result = await pool.query(
      `SELECT * FROM site_config WHERE site_id = $1 LIMIT 1`,
      [site.id]
    );

    if (result.rows.length === 0) {
      // Return default config if none exists
      return NextResponse.json({
        siteId: site.id,
        heatmapEnabled: false,
        replayEnabled: false,
        replayMaskingEnabled: true,
        selectorMode: 'lenient',
        maxDistinctEventKeysPerDay: 50000,
        maxDistinctPathsPerDay: 10000,
        maxDistinctDimensionValuesPerKeyPerDay: 5000,
        maxDistinctPerfNamesPerDay: 20000,
        maxDistinctSelectorsPerDay: 50000,
        dataRetentionDays: 90,
        piiMaskingEnabled: true,
        replaySampleRate: 0.1,
        allowedQueryParams: [],
      });
    }

    const config = result.rows[0];
    return NextResponse.json({
      siteId: config.site_id,
      heatmapEnabled: config.heatmap_enabled ?? false,
      replayEnabled: config.replay_enabled ?? false,
      replayMaskingEnabled: config.replay_masking_enabled ?? true,
      selectorMode: config.selector_mode ?? 'lenient',
      maxDistinctEventKeysPerDay: config.max_distinct_event_keys_per_day ?? 50000,
      maxDistinctPathsPerDay: config.max_distinct_paths_per_day ?? 10000,
      maxDistinctDimensionValuesPerKeyPerDay: config.max_distinct_dimension_values_per_key_per_day ?? 5000,
      maxDistinctPerfNamesPerDay: config.max_distinct_perf_names_per_day ?? 20000,
      maxDistinctSelectorsPerDay: config.max_distinct_selectors_per_day ?? 50000,
      dataRetentionDays: config.data_retention_days ?? 90,
      piiMaskingEnabled: config.pii_masking_enabled ?? true,
      replaySampleRate: config.replay_sample_rate ?? 0.1,
      allowedQueryParams: config.allowed_query_params ?? [],
    });
  } catch (error) {
    console.error('Error fetching site config:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { authorized, site } = await verifySiteAccess(params.id);
    if (!authorized || !site) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const pool = getPool();

    // Upsert site config
    await pool.query(
      `INSERT INTO site_config (
        site_id, heatmap_enabled, replay_enabled, replay_masking_enabled,
        selector_mode, max_distinct_event_keys_per_day, max_distinct_paths_per_day,
        max_distinct_dimension_values_per_key_per_day, max_distinct_perf_names_per_day,
        max_distinct_selectors_per_day, data_retention_days, pii_masking_enabled,
        replay_sample_rate, allowed_query_params, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW()
      )
      ON CONFLICT (site_id) DO UPDATE SET
        heatmap_enabled = EXCLUDED.heatmap_enabled,
        replay_enabled = EXCLUDED.replay_enabled,
        replay_masking_enabled = EXCLUDED.replay_masking_enabled,
        selector_mode = EXCLUDED.selector_mode,
        max_distinct_event_keys_per_day = EXCLUDED.max_distinct_event_keys_per_day,
        max_distinct_paths_per_day = EXCLUDED.max_distinct_paths_per_day,
        max_distinct_dimension_values_per_key_per_day = EXCLUDED.max_distinct_dimension_values_per_key_per_day,
        max_distinct_perf_names_per_day = EXCLUDED.max_distinct_perf_names_per_day,
        max_distinct_selectors_per_day = EXCLUDED.max_distinct_selectors_per_day,
        data_retention_days = EXCLUDED.data_retention_days,
        pii_masking_enabled = EXCLUDED.pii_masking_enabled,
        replay_sample_rate = EXCLUDED.replay_sample_rate,
        allowed_query_params = EXCLUDED.allowed_query_params,
        updated_at = NOW()`,
      [
        site.id,
        body.heatmapEnabled ?? false,
        body.replayEnabled ?? false,
        body.replayMaskingEnabled ?? true,
        body.selectorMode ?? 'lenient',
        body.maxDistinctEventKeysPerDay ?? 50000,
        body.maxDistinctPathsPerDay ?? 10000,
        body.maxDistinctDimensionValuesPerKeyPerDay ?? 5000,
        body.maxDistinctPerfNamesPerDay ?? 20000,
        body.maxDistinctSelectorsPerDay ?? 50000,
        body.dataRetentionDays ?? 90,
        body.piiMaskingEnabled ?? true,
        body.replaySampleRate ?? 0.1,
        JSON.stringify(body.allowedQueryParams ?? []),
      ]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving site config:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
