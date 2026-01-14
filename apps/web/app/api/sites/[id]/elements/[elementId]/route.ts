import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@analytics/db';
import { verifySiteAccess } from '@/lib/auth-helpers';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; elementId: string } }
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
      WHERE site_id = $1 AND element_id = $2
      `,
      [site.id, decodeURIComponent(params.elementId)]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Element not found' }, { status: 404 });
    }

    const r = result.rows[0];
    return NextResponse.json({
      element: {
        id: r.id,
        elementId: r.element_id,
        label: r.label,
        role: r.role,
        notes: r.notes,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      },
    });
  } catch (error) {
    console.error('Error fetching element metadata:', error);
    return NextResponse.json(
      { error: 'Failed to fetch element metadata' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string; elementId: string } }
) {
  try {
    const { authorized, site } = await verifySiteAccess(params.id);
    if (!authorized || !site) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { label, role, notes } = body;

    const pool = getPool();
    const result = await pool.query(
      `
      UPDATE element_metadata
      SET label = $3, role = $4, notes = $5, updated_at = NOW()
      WHERE site_id = $1 AND element_id = $2
      RETURNING id, element_id, label, role, notes, created_at, updated_at
      `,
      [site.id, decodeURIComponent(params.elementId), label || null, role || null, notes || null]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Element not found' }, { status: 404 });
    }

    const r = result.rows[0];
    return NextResponse.json({
      element: {
        id: r.id,
        elementId: r.element_id,
        label: r.label,
        role: r.role,
        notes: r.notes,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      },
    });
  } catch (error) {
    console.error('Error updating element metadata:', error);
    return NextResponse.json(
      { error: 'Failed to update element metadata' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; elementId: string } }
) {
  try {
    const { authorized, site } = await verifySiteAccess(params.id);
    if (!authorized || !site) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const pool = getPool();
    const result = await pool.query(
      `
      DELETE FROM element_metadata
      WHERE site_id = $1 AND element_id = $2
      RETURNING id
      `,
      [site.id, decodeURIComponent(params.elementId)]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Element not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting element metadata:', error);
    return NextResponse.json(
      { error: 'Failed to delete element metadata' },
      { status: 500 }
    );
  }
}


