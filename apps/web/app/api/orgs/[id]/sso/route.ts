import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@analytics/db';
import { verifyOrgAccess } from '@/lib/auth-helpers';
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

    const pool = getPool();
    const result = await pool.query(
      'SELECT * FROM sso_config WHERE org_id = $1 LIMIT 1',
      [params.id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ 
        enabled: false,
        provider: null,
      });
    }

    const config = result.rows[0];
    const configData = config.config || {};

    // Don't return sensitive config (certificates, secrets)
    const safeConfig = {
      id: config.id,
      provider: config.provider,
      enabled: config.enabled,
      entityId: configData.entityId,
      ssoUrl: configData.ssoUrl,
      createdAt: config.created_at,
      updatedAt: config.updated_at,
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

    const pool = getPool();
    
    // Check if config exists
    const existingResult = await pool.query(
      'SELECT id FROM sso_config WHERE org_id = $1 LIMIT 1',
      [params.id]
    );

    const configJson = JSON.stringify(ssoConfigData || {});

    if (existingResult.rows.length > 0) {
      const result = await pool.query(
        `UPDATE sso_config 
         SET provider = $1, enabled = $2, config = $3, updated_at = NOW()
         WHERE org_id = $4
         RETURNING id, org_id as "orgId", provider, enabled, config, created_at as "createdAt", updated_at as "updatedAt"`,
        [provider || 'saml', enabled ?? false, configJson, params.id]
      );

      return NextResponse.json(result.rows[0]);
    } else {
      const id = nanoid();
      const result = await pool.query(
        `INSERT INTO sso_config (id, org_id, provider, enabled, config, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
         RETURNING id, org_id as "orgId", provider, enabled, config, created_at as "createdAt", updated_at as "updatedAt"`,
        [id, params.id, provider || 'saml', enabled ?? false, configJson]
      );

      return NextResponse.json(result.rows[0], { status: 201 });
    }
  } catch (error) {
    console.error('Error updating SSO config:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
