import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@analytics/db';
import { ssoConfig } from '@analytics/db';
import { verifyOrgAccess } from '@/lib/auth-helpers';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';

/**
 * SSO Configuration Management
 * GET /api/orgs/:id/sso - Get SSO config
 * PUT /api/orgs/:id/sso - Update SSO config
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

    const db = getDb();
    const config = await db
      .select()
      .from(ssoConfig)
      .where(eq(ssoConfig.orgId, params.id))
      .limit(1);

    if (config.length === 0) {
      return NextResponse.json({ 
        enabled: false,
        provider: null,
      });
    }

    // Don't return sensitive config (certificates, secrets)
    const safeConfig = {
      id: config[0].id,
      provider: config[0].provider,
      enabled: config[0].enabled,
      entityId: (config[0].config as any).entityId,
      ssoUrl: (config[0].config as any).ssoUrl,
      createdAt: config[0].createdAt,
      updatedAt: config[0].updatedAt,
    };

    return NextResponse.json(safeConfig);
  } catch (error) {
    console.error('Error fetching SSO config:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { authorized } = await verifyOrgAccess(params.id);
    if (!authorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { provider, enabled, config: ssoConfigData } = body;

    const db = getDb();
    
    // Check if config exists
    const existing = await db
      .select()
      .from(ssoConfig)
      .where(eq(ssoConfig.orgId, params.id))
      .limit(1);

    const configData = {
      orgId: params.id,
      provider: provider || 'saml',
      enabled: enabled ?? false,
      config: ssoConfigData || {},
      updatedAt: new Date(),
    };

    if (existing.length > 0) {
      const [updated] = await db
        .update(ssoConfig)
        .set(configData)
        .where(eq(ssoConfig.orgId, params.id))
        .returning();

      return NextResponse.json(updated);
    } else {
      const [created] = await db
        .insert(ssoConfig)
        .values({
          id: nanoid(),
          ...configData,
        })
        .returning();

      return NextResponse.json(created, { status: 201 });
    }
  } catch (error) {
    console.error('Error updating SSO config:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
