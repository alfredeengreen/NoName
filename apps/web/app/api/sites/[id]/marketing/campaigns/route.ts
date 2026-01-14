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
    const campaignResult = await pool.query(
      'SELECT * FROM campaigns WHERE site_id = $1',
      [site.id]
    );
    const campaignList = campaignResult.rows.map(row => ({
      id: row.id,
      siteId: row.site_id,
      name: row.name,
      utmSource: row.utm_source,
      utmMedium: row.utm_medium,
      utmCampaign: row.utm_campaign,
      cost: row.cost ? Number(row.cost) : null,
      budget: row.budget ? Number(row.budget) : null,
      startDate: row.start_date,
      endDate: row.end_date,
      description: row.description,
      createdAt: row.created_at,
    }));

    return NextResponse.json({ campaigns: campaignList });
  } catch (error) {
    console.error('Error fetching campaigns:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
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
    const { name, utmSource, utmMedium, utmCampaign, cost, budget, startDate, endDate, description } = body;

    if (!name) {
      return NextResponse.json({ error: 'Campaign name is required' }, { status: 400 });
    }

    const pool = getPool();
    const campaignId = nanoid();
    
    const result = await pool.query(
      `INSERT INTO campaigns (id, site_id, name, utm_source, utm_medium, utm_campaign, cost, budget, start_date, end_date, description, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
       RETURNING *`,
      [
        campaignId,
        site.id,
        name,
        utmSource || null,
        utmMedium || null,
        utmCampaign || null,
        cost ? cost.toString() : null,
        budget ? budget.toString() : null,
        startDate ? new Date(startDate) : null,
        endDate ? new Date(endDate) : null,
        description || null,
      ]
    );

    const newCampaign = result.rows[0];
    return NextResponse.json({
      campaign: {
        id: newCampaign.id,
        siteId: newCampaign.site_id,
        name: newCampaign.name,
        utmSource: newCampaign.utm_source,
        utmMedium: newCampaign.utm_medium,
        utmCampaign: newCampaign.utm_campaign,
        cost: newCampaign.cost ? Number(newCampaign.cost) : null,
        budget: newCampaign.budget ? Number(newCampaign.budget) : null,
        startDate: newCampaign.start_date,
        endDate: newCampaign.end_date,
        description: newCampaign.description,
        createdAt: newCampaign.created_at,
      },
    });
  } catch (error) {
    console.error('Error creating campaign:', error);
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
    const { id, name, utmSource, utmMedium, utmCampaign, cost, budget, startDate, endDate, description } = body;

    if (!id) {
      return NextResponse.json({ error: 'Campaign ID is required' }, { status: 400 });
    }

    const pool = getPool();
    
    const result = await pool.query(
      `UPDATE campaigns 
       SET name = $3, utm_source = $4, utm_medium = $5, utm_campaign = $6, cost = $7, budget = $8, start_date = $9, end_date = $10, description = $11, updated_at = NOW()
       WHERE id = $1 AND site_id = $2
       RETURNING *`,
      [
        id,
        site.id,
        name,
        utmSource || null,
        utmMedium || null,
        utmCampaign || null,
        cost ? cost.toString() : null,
        budget ? budget.toString() : null,
        startDate ? new Date(startDate) : null,
        endDate ? new Date(endDate) : null,
        description || null,
      ]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    const updated = result.rows[0];
    return NextResponse.json({
      campaign: {
        id: updated.id,
        siteId: updated.site_id,
        name: updated.name,
        utmSource: updated.utm_source,
        utmMedium: updated.utm_medium,
        utmCampaign: updated.utm_campaign,
        cost: updated.cost ? Number(updated.cost) : null,
        budget: updated.budget ? Number(updated.budget) : null,
        startDate: updated.start_date,
        endDate: updated.end_date,
        description: updated.description,
        createdAt: updated.created_at,
      },
    });
  } catch (error) {
    console.error('Error updating campaign:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { authorized, site } = await verifySiteAccess(params.id);
    if (!authorized || !site) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const campaignId = searchParams.get('id');

    if (!campaignId) {
      return NextResponse.json({ error: 'Campaign ID is required' }, { status: 400 });
    }

    const pool = getPool();
    
    await pool.query(
      'DELETE FROM campaigns WHERE id = $1 AND site_id = $2',
      [campaignId, site.id]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting campaign:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

