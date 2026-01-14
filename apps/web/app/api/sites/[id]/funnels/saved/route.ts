import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@analytics/db';
import { verifySiteAccess } from '@/lib/auth-helpers';
import { nanoid } from 'nanoid';

// GET - List all saved funnels for a site
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
    const result = await pool.query(
      'SELECT id, name, steps, created_at, updated_at FROM saved_funnels WHERE site_id = $1 ORDER BY updated_at DESC',
      [site.id]
    );

    return NextResponse.json(
      result.rows.map((row) => ({
        id: row.id,
        name: row.name,
        steps: row.steps,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }))
    );
  } catch (error) {
    console.error('Error fetching saved funnels:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Save a new funnel
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { authorized, site } = await verifySiteAccess(params.id);
    if (!authorized || !site) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, steps } = body;

    if (!name || !steps || !Array.isArray(steps) || steps.length === 0) {
      return NextResponse.json({ error: 'Name and steps are required' }, { status: 400 });
    }

    const pool = getPool();
    const id = nanoid();
    const result = await pool.query(
      `INSERT INTO saved_funnels (id, site_id, name, steps, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       RETURNING id, name, steps, created_at, updated_at`,
      [id, site.id, name, JSON.stringify(steps)]
    );

    return NextResponse.json({
      id: result.rows[0].id,
      name: result.rows[0].name,
      steps: result.rows[0].steps,
      createdAt: result.rows[0].created_at,
      updatedAt: result.rows[0].updated_at,
    });
  } catch (error) {
    console.error('Error saving funnel:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


