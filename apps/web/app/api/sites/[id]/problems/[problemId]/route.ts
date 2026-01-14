import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@analytics/db';
import { verifySiteAccess } from '@/lib/auth-helpers';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; problemId: string } }
) {
  try {
    const { authorized, site } = await verifySiteAccess(params.id);
    if (!authorized || !site) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const pool = getPool();
    const siteId = site.id;
    const problemId = params.problemId;

    // Get problem with evidence
    const problemResult = await pool.query(
      `
      SELECT 
        p.*,
        json_agg(
          json_build_object(
            'id', pe.id,
            'evidenceType', pe.evidence_type,
            'evidenceData', pe.evidence_data,
            'sampleSessionIds', pe.sample_session_ids,
            'createdAt', pe.created_at
          )
        ) FILTER (WHERE pe.id IS NOT NULL) as evidence
      FROM problems p
      LEFT JOIN problem_evidence pe ON pe.problem_id = p.id
      WHERE p.id = $1 AND p.site_id = $2
      GROUP BY p.id
      `,
      [problemId, siteId]
    );

    if (problemResult.rows.length === 0) {
      return NextResponse.json({ error: 'Problem not found' }, { status: 404 });
    }

    return NextResponse.json(problemResult.rows[0]);
  } catch (error) {
    console.error('Error fetching problem:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string; problemId: string } }
) {
  try {
    const { authorized, site } = await verifySiteAccess(params.id);
    if (!authorized || !site) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const pool = getPool();
    const siteId = site.id;
    const problemId = params.problemId;
    const body = await request.json();

    const { status } = body;

    if (status && !['active', 'acknowledged', 'resolved', 'dismissed'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const updateFields: string[] = [];
    const updateValues: any[] = [];
    let paramIndex = 1;

    if (status) {
      updateFields.push(`status = $${paramIndex++}`);
      updateValues.push(status);
      
      if (status === 'resolved') {
        updateFields.push(`resolved_at = NOW()`);
      }
    }

    updateFields.push(`updated_at = NOW()`);
    updateValues.push(problemId, siteId);

    const query = `
      UPDATE problems
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex++} AND site_id = $${paramIndex++}
      RETURNING *
    `;

    const result = await pool.query(query, updateValues);

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Problem not found' }, { status: 404 });
    }

    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating problem:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
