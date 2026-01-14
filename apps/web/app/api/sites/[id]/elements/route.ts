import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@analytics/db';
import { verifySiteAccess } from '@/lib/auth-helpers';
import { nanoid } from 'nanoid';

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
      `
      SELECT 
        id,
        element_id,
        label,
        role,
        notes,
        created_at,
        updated_at
      FROM element_metadata
      WHERE site_id = $1
      ORDER BY updated_at DESC
      `,
      [site.id]
    );

    return NextResponse.json({
      elements: result.rows.map((r: any) => ({
        id: r.id,
        elementId: r.element_id,
        label: r.label,
        role: r.role,
        notes: r.notes,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      })),
    });
  } catch (error) {
    console.error('Error fetching element metadata:', error);
    return NextResponse.json(
      { error: 'Failed to fetch element metadata' },
      { status: 500 }
    );
  }
}

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
    const { elementId, label, role, notes } = body;

    if (!elementId) {
      return NextResponse.json(
        { error: 'elementId is required' },
        { status: 400 }
      );
    }

    const pool = getPool();

    // Check if element already exists
    const existing = await pool.query(
      `
      SELECT id FROM element_metadata
      WHERE site_id = $1 AND element_id = $2
      `,
      [site.id, elementId]
    );

    if (existing.rows.length > 0) {
      // Update existing
      const result = await pool.query(
        `
        UPDATE element_metadata
        SET label = $3, role = $4, notes = $5, updated_at = NOW()
        WHERE site_id = $1 AND element_id = $2
        RETURNING id, element_id, label, role, notes, created_at, updated_at
        `,
        [site.id, elementId, label || null, role || null, notes || null]
      );

      return NextResponse.json({
        element: {
          id: result.rows[0].id,
          elementId: result.rows[0].element_id,
          label: result.rows[0].label,
          role: result.rows[0].role,
          notes: result.rows[0].notes,
          createdAt: result.rows[0].created_at,
          updatedAt: result.rows[0].updated_at,
        },
      });
    } else {
      // Create new
      const id = nanoid();
      const result = await pool.query(
        `
        INSERT INTO element_metadata (id, site_id, element_id, label, role, notes)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, element_id, label, role, notes, created_at, updated_at
        `,
        [id, site.id, elementId, label || null, role || null, notes || null]
      );

      return NextResponse.json({
        element: {
          id: result.rows[0].id,
          elementId: result.rows[0].element_id,
          label: result.rows[0].label,
          role: result.rows[0].role,
          notes: result.rows[0].notes,
          createdAt: result.rows[0].created_at,
          updatedAt: result.rows[0].updated_at,
        },
      });
    }
  } catch (error) {
    console.error('Error creating/updating element metadata:', error);
    return NextResponse.json(
      { error: 'Failed to create/update element metadata' },
      { status: 500 }
    );
  }
}


