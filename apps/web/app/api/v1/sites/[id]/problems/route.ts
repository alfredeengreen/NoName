import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@analytics/db';

/**
 * REST API v1 - Problems endpoint
 * GET /api/v1/sites/:id/problems - List problems for a site
 */

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // TODO: Implement API key authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const pool = getPool();
    const siteId = params.id;
    const { searchParams } = new URL(request.url);
    
    const type = searchParams.get('type');
    const severity = searchParams.get('severity');
    const status = searchParams.get('status') || 'active';
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    let query = `
      SELECT 
        p.*,
        json_agg(
          json_build_object(
            'id', pe.id,
            'evidenceType', pe.evidence_type,
            'evidenceData', pe.evidence_data,
            'sampleSessionIds', pe.sample_session_ids
          )
        ) FILTER (WHERE pe.id IS NOT NULL) as evidence
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

    query += `
      GROUP BY p.id
      ORDER BY p.impact_score DESC, p.last_seen DESC
      LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}
    `;
    queryParams.push(limit, offset);

    const result = await pool.query(query, queryParams);

    return NextResponse.json({
      data: result.rows,
      pagination: {
        limit,
        offset,
        total: result.rows.length,
      },
    });
  } catch (error) {
    console.error('Error fetching problems:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
