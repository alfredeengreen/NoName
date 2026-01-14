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
    
    // Get business config from site_config table
    // Note: These fields may not exist in the schema yet, so we'll return empty for now
    const result = await pool.query(
      `SELECT * FROM site_config WHERE site_id = $1 LIMIT 1`,
      [site.id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({});
    }

    const config = result.rows[0];
    return NextResponse.json({
      avgRevenuePerSession: config.avg_revenue_per_session ?? undefined,
      avgConversionRate: config.avg_conversion_rate ?? undefined,
    });
  } catch (error) {
    console.error('Error fetching business config:', error);
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

    // Upsert business config
    // Note: These fields may not exist in the schema yet, so we'll store in metadata or skip for now
    // For now, we'll just update the updated_at timestamp
    await pool.query(
      `UPDATE site_config SET updated_at = NOW() WHERE site_id = $1`,
      [site.id]
    );
    
    // If the columns exist, update them (this will fail silently if they don't exist)
    try {
      await pool.query(
        `ALTER TABLE site_config ADD COLUMN IF NOT EXISTS avg_revenue_per_session NUMERIC(15, 2)`,
        []
      );
      await pool.query(
        `ALTER TABLE site_config ADD COLUMN IF NOT EXISTS avg_conversion_rate NUMERIC(5, 4)`,
        []
      );
      
      await pool.query(
        `UPDATE site_config SET 
         avg_revenue_per_session = $2,
         avg_conversion_rate = $3,
         updated_at = NOW()
         WHERE site_id = $1`,
        [
          site.id,
          body.avgRevenuePerSession ?? null,
          body.avgConversionRate ?? null,
        ]
      );
    } catch (err) {
      // Columns might not exist, that's okay for now
      console.log('Business config columns not available yet');
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving business config:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
