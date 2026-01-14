import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@analytics/db';
import { verifySiteAccess } from '@/lib/auth-helpers';

/**
 * Data Export
 * GET /api/sites/:id/export - Export site data
 */

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
    const format = searchParams.get('format') || 'json'; // json, csv
    const type = searchParams.get('type') || 'events'; // events, problems, all
    const startDate = searchParams.get('start');
    const endDate = searchParams.get('end');

    const pool = getPool();
    const siteId = site.id;

    if (type === 'events' || type === 'all') {
      let query = `
        SELECT *
        FROM events_raw
        WHERE site_id = $1
      `;
      const params: any[] = [siteId];

      if (startDate) {
        query += ` AND ts >= $${params.length + 1}`;
        params.push(startDate);
      }
      if (endDate) {
        query += ` AND ts <= $${params.length + 1}`;
        params.push(endDate);
      }

      query += ` ORDER BY ts DESC LIMIT 10000`;

      const result = await pool.query(query, params);

      if (format === 'csv') {
        // Convert to CSV
        const headers = Object.keys(result.rows[0] || {});
        const csvRows = [
          headers.join(','),
          ...result.rows.map(row => 
            headers.map(header => {
              const value = row[header];
              return typeof value === 'string' ? `"${value.replace(/"/g, '""')}"` : value;
            }).join(',')
          ),
        ];
        
        return new NextResponse(csvRows.join('\n'), {
          headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename="events_${siteId}_${Date.now()}.csv"`,
          },
        });
      } else {
        return NextResponse.json({
          format: 'json',
          type: 'events',
          count: result.rows.length,
          data: result.rows,
        });
      }
    }

    if (type === 'problems' || type === 'all') {
      const problemsResult = await pool.query(
        `
        SELECT p.*, json_agg(pe.*) as evidence
        FROM problems p
        LEFT JOIN problem_evidence pe ON pe.problem_id = p.id
        WHERE p.site_id = $1
        GROUP BY p.id
        ORDER BY p.impact_score DESC
        `,
        [siteId]
      );

      if (format === 'csv') {
        // Simplified CSV export for problems
        const csvRows = [
          'id,type,severity,title,impact_score,affected_sessions,created_at',
          ...problemsResult.rows.map(p => 
            `${p.id},${p.type},${p.severity},"${p.title}",${p.impact_score},${p.affected_sessions},${p.created_at}`
          ),
        ];
        
        return new NextResponse(csvRows.join('\n'), {
          headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename="problems_${siteId}_${Date.now()}.csv"`,
          },
        });
      } else {
        return NextResponse.json({
          format: 'json',
          type: 'problems',
          count: problemsResult.rows.length,
          data: problemsResult.rows,
        });
      }
    }

    return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
  } catch (error) {
    console.error('Error exporting data:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
