import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@analytics/db';
import { verifyOrgAccess } from '@/lib/auth-helpers';

/**
 * Usage Monitoring
 * GET /api/orgs/:id/usage - Get usage metrics
 */

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { authorized } = await verifyOrgAccess(params.id);
    if (!authorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const pool = getPool();
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30', 10);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get usage metrics
    const usage = await pool.query(
      `
      SELECT 
        DATE(day) as date,
        SUM(event_count) as total_events,
        SUM(storage_bytes) as total_storage,
        SUM(api_calls) as total_api_calls
      FROM usage_metrics
      WHERE org_id = $1 AND day >= $2
      GROUP BY DATE(day)
      ORDER BY DATE(day) DESC
      `,
      [params.id, startDate]
    );

    // Calculate totals
    const totals = await pool.query(
      `
      SELECT 
        SUM(event_count) as total_events,
        SUM(storage_bytes) as total_storage,
        SUM(api_calls) as total_api_calls
      FROM usage_metrics
      WHERE org_id = $1 AND day >= $2
      `,
      [params.id, startDate]
    );

    // Estimate costs (example pricing)
    const eventCount = Number(totals.rows[0]?.total_events || 0);
    const storageBytes = Number(totals.rows[0]?.total_storage || 0);
    const apiCalls = Number(totals.rows[0]?.total_api_calls || 0);

    const estimatedCost = {
      events: (eventCount / 1000000) * 0.50, // $0.50 per million events
      storage: (storageBytes / (1024 * 1024 * 1024)) * 0.10, // $0.10 per GB
      api: (apiCalls / 10000) * 0.10, // $0.10 per 10k API calls
      total: 0,
    };
    estimatedCost.total = estimatedCost.events + estimatedCost.storage + estimatedCost.api;

    return NextResponse.json({
      period: {
        start: startDate.toISOString(),
        end: new Date().toISOString(),
        days,
      },
      daily: usage.rows,
      totals: {
        events: eventCount,
        storage: storageBytes,
        apiCalls,
      },
      estimatedCost,
    });
  } catch (error) {
    console.error('Error fetching usage:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
