import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { getPool } from '@analytics/db';
import { nanoid } from 'nanoid';
import { getDefaultPathRules } from '@analytics/shared';
import { getCurrentUser, getUserOrgs } from '@/lib/auth-helpers';

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body;
    try {
      body = await request.json();
    } catch (parseError: any) {
      console.error('Error parsing request body:', parseError);
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const { name } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Site name is required' }, { status: 400 });
    }

    // Validate name length
    if (name.length > 255) {
      return NextResponse.json({ error: 'Site name must be 255 characters or less' }, { status: 400 });
    }

    // Get user's orgs
    let userOrgs;
    try {
      userOrgs = await getUserOrgs(user.id);
    } catch (orgsError: any) {
      console.error('Error getting user orgs:', {
        userId: user.id,
        error: orgsError.message,
        code: orgsError.code,
      });
      return NextResponse.json({ 
        error: 'Failed to retrieve your organizations. Please try again.' 
      }, { status: 500 });
    }
    
    // If user has no org, create one automatically
    if (!userOrgs || userOrgs.length === 0) {
      const pool = getPool();
      
      try {
        const orgId = nanoid();
        await pool.query(
          'INSERT INTO orgs (id, name, created_at) VALUES ($1, $2, NOW())',
          [orgId, `${user.email}'s Organization`]
        );

        // Use raw SQL for org_members to handle potential missing created_at column
        await pool.query(`
          INSERT INTO org_members (org_id, user_id, role, created_at)
          VALUES ($1, $2, $3, NOW())
          ON CONFLICT (org_id, user_id) DO NOTHING
        `, [orgId, user.id, 'owner']);

        userOrgs = [{ id: orgId, name: `${user.email}'s Organization`, createdAt: new Date() }];
      } catch (orgError: any) {
        console.error('Error creating organization for user:', {
          userId: user.id,
          error: orgError.message,
          stack: orgError.stack,
          code: orgError.code,
        });
        return NextResponse.json({ 
          error: 'Failed to create organization. Please contact support.' 
        }, { status: 500 });
      }
    }

    // Use the first org the user belongs to
    const orgId = userOrgs[0].id;

    const pool = getPool();
    
    // Ensure pool is initialized
    if (!pool) {
      console.error('Database pool not initialized');
      return NextResponse.json({ 
        error: 'Database connection not available. Please try again.' 
      }, { status: 500 });
    }
    
    const siteId = nanoid();
    const publicSiteId = nanoid(12);
    const publicWriteKey = nanoid(32);

    // Validate getDefaultPathRules returns valid data
    let defaultPathRules;
    try {
      defaultPathRules = getDefaultPathRules();
      if (!Array.isArray(defaultPathRules)) {
        throw new Error('getDefaultPathRules() did not return an array');
      }
    } catch (rulesError: any) {
      console.error('Error getting default path rules:', {
        error: rulesError.message,
        stack: rulesError.stack,
      });
      return NextResponse.json({ 
        error: 'Failed to initialize site configuration' 
      }, { status: 500 });
    }

    // Use transaction for atomicity
    let client;
    let transactionStarted = false;
    try {
      client = await pool.connect();
      await client.query('BEGIN');
      transactionStarted = true;

      // Create site
      try {
        await client.query(`
          INSERT INTO sites (id, org_id, name, public_site_id, public_write_key, created_at)
          VALUES ($1, $2, $3, $4, $5, NOW())
        `, [siteId, orgId, name.trim(), publicSiteId, publicWriteKey]);
      } catch (siteError: any) {
        console.error('Error inserting site:', {
          siteId,
          orgId,
          name: name.trim(),
          error: siteError.message,
          code: siteError.code,
          constraint: siteError.constraint,
        });
        throw siteError;
      }

      // Create default path rules
      try {
        const pathRuleId = nanoid();
        await client.query(`
          INSERT INTO path_rules (id, site_id, rules_json, updated_at)
          VALUES ($1, $2, $3, NOW())
        `, [pathRuleId, siteId, JSON.stringify(defaultPathRules)]);
      } catch (pathRuleError: any) {
        console.error('Error inserting path rules:', {
          siteId,
          error: pathRuleError.message,
          code: pathRuleError.code,
          constraint: pathRuleError.constraint,
        });
        throw pathRuleError;
      }

      // Create default event defs for built-ins
      const builtIns = ['pageview', 'click', 'form_submit', 'outbound_click'];
      for (const eventName of builtIns) {
        try {
          await client.query(`
            INSERT INTO event_defs (id, site_id, event_name, enabled, props_allowlist, value_rule, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, NOW())
          `, [
            nanoid(),
            siteId,
            eventName,
            true,
            JSON.stringify([]),
            JSON.stringify({ mode: 'none' }),
          ]);
        } catch (eventDefError: any) {
          console.error('Error inserting event def:', {
            siteId,
            eventName,
            error: eventDefError.message,
            code: eventDefError.code,
          });
          throw eventDefError;
        }
      }

      await client.query('COMMIT');
      transactionStarted = false;
    } catch (dbError: any) {
      if (transactionStarted && client) {
        try {
          await client.query('ROLLBACK');
        } catch (rollbackError: any) {
          console.error('Error rolling back transaction:', {
            error: rollbackError.message,
            code: rollbackError.code,
          });
        }
      }
      throw dbError;
    } finally {
      if (client) {
        client.release();
      }
    }

    return NextResponse.json({ success: true, siteId });
  } catch (error: any) {
    // Handle specific database errors
    const errorDetails: any = {
      error: error.message,
      stack: error.stack,
      code: error.code,
      detail: error.detail,
      constraint: error.constraint,
    };

    // Add context if available
    try {
      const user = await getCurrentUser();
      if (user) {
        errorDetails.userId = user.id;
      }
    } catch {
      // Ignore errors getting user context
    }

    console.error('Error creating site:', errorDetails);

    // Check for specific database error codes
    if (error.code === '23505') { // Unique violation
      if (error.constraint?.includes('public_site_id')) {
        return NextResponse.json({ 
          error: 'A site with this ID already exists. Please try again.' 
        }, { status: 409 });
      }
      return NextResponse.json({ 
        error: 'A site with this name already exists in your organization' 
      }, { status: 409 });
    }

    if (error.code === '23503') { // Foreign key violation
      return NextResponse.json({ 
        error: 'Invalid organization. Please contact support.' 
      }, { status: 400 });
    }

    // Generic error - return more detailed error message for debugging
    const errorMessage = error.message || 'Unknown error occurred';
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    return NextResponse.json({ 
      error: isDevelopment 
        ? `Failed to create site: ${errorMessage}${error.code ? ` (Code: ${error.code})` : ''}`
        : 'Failed to create site. Please try again or contact support if the problem persists.',
      ...(isDevelopment && { details: errorDetails })
    }, { status: 500 });
  }
}

