import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@analytics/db';
import { getErrorTrends, getErrorResolutionTracking } from '@analytics/db/src/queries';
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
    const type = searchParams.get('type');
    const environment = searchParams.get('environment');
    const release = searchParams.get('release');
    const resolved = searchParams.get('resolved');
    const search = searchParams.get('search');
    const start = searchParams.get('start') ? new Date(searchParams.get('start')!) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const end = searchParams.get('end') ? new Date(searchParams.get('end')!) : new Date();

    const pool = getPool();

    // Build WHERE conditions
    const whereConditions: string[] = ['site_id = $1'];
    const values: any[] = [site.id];
    let paramIndex = 2;

    if (type) {
      whereConditions.push(`type = $${paramIndex++}`);
      values.push(type);
    }

    if (environment) {
      whereConditions.push(`environment = $${paramIndex++}`);
      values.push(environment);
    }

    if (release) {
      whereConditions.push(`release = $${paramIndex++}`);
      values.push(release);
    }

    if (resolved !== null) {
      whereConditions.push(`resolved = $${paramIndex++}`);
      values.push(resolved === 'true');
    }

    if (search) {
      whereConditions.push(`(message ILIKE $${paramIndex} OR fingerprint ILIKE $${paramIndex})`);
      values.push(`%${search}%`);
      paramIndex++;
    }

    whereConditions.push(`last_seen >= $${paramIndex++}`);
    values.push(start);
    whereConditions.push(`last_seen <= $${paramIndex++}`);
    values.push(end);

    // Get errors with event counts using raw SQL
    const result = await pool.query(
      `SELECT 
        e.id,
        e.fingerprint,
        e.type,
        e.message,
        e.url,
        e.first_seen as "firstSeen",
        e.last_seen as "lastSeen",
        e.count,
        e.resolved,
        e.resolved_at as "resolvedAt",
        e.environment,
        e.release,
        (SELECT COUNT(*)::INTEGER FROM error_events WHERE error_id = e.id) as "eventCount",
        (SELECT COUNT(DISTINCT vid)::INTEGER FROM error_events WHERE error_id = e.id) as "affectedUsers"
      FROM errors e
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY e.last_seen DESC
      LIMIT 100`,
      values
    );

    const errorsList = result.rows;

    const timeRange = { start, end };
    const [errorTrends, resolutionTracking] = await Promise.all([
      getErrorTrends(site.id, timeRange, type || undefined).catch(() => []),
      getErrorResolutionTracking(site.id, timeRange).catch(() => []),
    ]);

    return NextResponse.json({ 
      errors: Array.isArray(errorsList) ? errorsList : [],
      errorTrends: Array.isArray(errorTrends) ? errorTrends : [],
      resolutionTracking: Array.isArray(resolutionTracking) ? resolutionTracking : [],
    });
  } catch (error) {
    console.error('Error fetching errors:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

