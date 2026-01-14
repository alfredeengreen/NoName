import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@analytics/db';
import { verifySiteAccess, getCurrentUser } from '@/lib/auth-helpers';
import { logUserAction } from '@/lib/security';

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
    const siteId = site.id;
    const { searchParams } = new URL(request.url);
    
    // Get filters
    const type = searchParams.get('type');
    const severity = searchParams.get('severity');
    const path = searchParams.get('path');
    const status = searchParams.get('status') || 'active';

    // Build query
    let query = `
      SELECT 
        p.id,
        p.site_id as "siteId",
        p.type,
        p.severity,
        p.title,
        p.description,
        p.impact_score as "impactScore",
        p.affected_sessions as "affectedSessions",
        p.revenue_impact as "revenueImpact",
        p.affected_revenue as "affectedRevenue",
        p.status,
        p.first_seen as "firstSeen",
        p.last_seen as "lastSeen",
        p.metadata,
        COALESCE(
          json_agg(
            json_build_object(
              'id', pe.id,
              'evidenceType', pe.evidence_type,
              'evidenceData', pe.evidence_data,
              'sampleSessionIds', pe.sample_session_ids
            )
          ) FILTER (WHERE pe.id IS NOT NULL),
          '[]'::json
        ) as evidence
      FROM problems p
      LEFT JOIN problem_evidence pe ON pe.problem_id = p.id
      WHERE p.site_id = $1
    `;
    const queryParams: any[] = [siteId];

    if (status) {
      query += ` AND p.status = $${queryParams.length + 1}`;
      queryParams.push(status);
    }

    if (type) {
      query += ` AND p.type = $${queryParams.length + 1}`;
      queryParams.push(type);
    }

    if (severity) {
      query += ` AND p.severity = $${queryParams.length + 1}`;
      queryParams.push(severity);
    }

    if (path) {
      query += ` AND p.metadata->>'path' LIKE $${queryParams.length + 1}`;
      queryParams.push(`%${path}%`);
    }

    query += `
      GROUP BY p.id, p.site_id, p.type, p.severity, p.title, p.description,
               p.impact_score, p.affected_sessions, p.revenue_impact, p.affected_revenue,
               p.status, p.first_seen, p.last_seen, p.metadata
      ORDER BY p.impact_score DESC, p.last_seen DESC
      LIMIT 100
    `;

    // Check if problems table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'problems'
      );
    `);
    
    if (!tableCheck.rows[0]?.exists) {
      // Table doesn't exist yet, return empty array
      return NextResponse.json([]);
    }

    const result = await pool.query(query, queryParams);

    // Log user action (if logUserAction exists)
    try {
      const user = await getCurrentUser();
      if (user) {
        await logUserAction(
          user.id,
          site.orgId,
          'view_problems',
          'problems',
          null,
          request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
          request.headers.get('user-agent') || null
        );
      }
    } catch (logError) {
      // Logging is optional, don't fail the request
      console.log('Could not log user action:', logError);
    }

    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('Error fetching problems:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
