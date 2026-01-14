import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@analytics/db';
import { verifyOrgAccess } from '@/lib/auth-helpers';
import { nanoid } from 'nanoid';
import { createHash } from 'node:crypto';

/**
 * API Key Management
 * GET /api/api-keys - List API keys for org
 * POST /api/api-keys - Create new API key
 */

export async function GET(request: NextRequest) {
  try {
    const orgId = request.headers.get('x-org-id');
    if (!orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { authorized } = await verifyOrgAccess(orgId);
    if (!authorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const pool = getPool();
    const result = await pool.query(
      'SELECT id, name, permissions, rate_limit as "rateLimit", last_used_at as "lastUsedAt", expires_at as "expiresAt", created_at as "createdAt" FROM api_keys WHERE org_id = $1 ORDER BY created_at DESC',
      [orgId]
    );

    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('Error fetching API keys:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const orgId = request.headers.get('x-org-id');
    if (!orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { authorized, userId } = await verifyOrgAccess(orgId);
    if (!authorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, permissions, rateLimit, expiresAt } = body;

    // Generate API key
    const apiKey = `aa_${nanoid(32)}`;
    const keyHash = createHash('sha256').update(apiKey).digest('hex');

    const pool = getPool();
    const keyId = nanoid();
    const result = await pool.query(
      `INSERT INTO api_keys (id, org_id, name, key_hash, permissions, rate_limit, expires_at, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, name, permissions, rate_limit as "rateLimit", expires_at as "expiresAt", created_at as "createdAt"`,
      [
        keyId,
        orgId,
        name || 'API Key',
        keyHash,
        JSON.stringify(permissions || ['read:problems', 'read:events']),
        rateLimit || 1000,
        expiresAt ? new Date(expiresAt) : null,
        userId || null,
      ]
    );
    const created = result.rows[0];

    // Return the key only once (never stored in DB)
    return NextResponse.json({
      id: created.id,
      name: created.name,
      key: apiKey, // Only returned on creation
      permissions: created.permissions,
      rateLimit: created.rateLimit,
      expiresAt: created.expiresAt,
      createdAt: created.createdAt,
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating API key:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
