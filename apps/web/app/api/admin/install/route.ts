import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { getCurrentUser } from '@/lib/auth-helpers';
import { verifySiteAccess } from '@/lib/auth-helpers';
import { getPool } from '@analytics/db';

async function isAdmin(userId: string): Promise<boolean> {
  const pool = getPool();
  const result = await pool.query(`
    SELECT COUNT(*) as count
    FROM org_members
    WHERE user_id = $1 AND role IN ('owner', 'admin')
    LIMIT 1
  `, [userId]);

  return Number(result.rows[0].count) > 0;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = await isAdmin(user.id);
    if (!admin) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const siteId = searchParams.get('siteId');
    if (!siteId) {
      return NextResponse.json({ error: 'Site ID required' }, { status: 400 });
    }

    const { authorized, site } = await verifySiteAccess(siteId);
    if (!authorized || !site) {
      return NextResponse.json({ error: 'Site not found' }, { status: 404 });
    }

    // Use public collector URL for client-side script
    const COLLECTOR_URL = process.env.COLLECTOR_URL || 'https://noname.fyi/collector';
    const scriptUrl = `${COLLECTOR_URL}/analytics.js`;
    
    // Get webApiUrl - prefer origin header, but ensure it's the production domain
    let webApiUrl = request.headers.get('origin') || request.headers.get('host');
    if (webApiUrl && !webApiUrl.startsWith('http')) {
      webApiUrl = `https://${webApiUrl}`;
    }
    // Fallback to production domain if origin is invalid (e.g., 0.0.0.0:3000)
    if (!webApiUrl || webApiUrl.includes('0.0.0.0') || webApiUrl.includes('localhost') || webApiUrl.includes('127.0.0.1')) {
      webApiUrl = 'https://noname.fyi/app';
    } else if (!webApiUrl.endsWith('/app')) {
      // Ensure webApiUrl includes the basePath
      webApiUrl = webApiUrl.endsWith('/') ? `${webApiUrl}app` : `${webApiUrl}/app`;
    }

    const installScript = `
<!-- NO NAME ANALYTICS -->
<script>
  (function() {
    var script = document.createElement('script');
    script.src = '${scriptUrl}';
    script.async = true;
    script.onload = function() {
      // Give the script a moment to execute and set window.aa
      setTimeout(function() {
        // Poll for window.aa.init to be available (script might still be initializing)
        var attempts = 0;
        var maxAttempts = 100; // Try for up to 10 seconds (100 * 100ms)
        var checkInit = function() {
          attempts++;
          // Check window.aa explicitly (not just aa, which might be undefined)
          if (typeof window !== 'undefined' && typeof window.aa !== 'undefined' && typeof window.aa.init === 'function') {
            try {
              window.aa.init({
                siteId: '${site.publicSiteId}',
                key: '${site.publicWriteKey}',
                endpoint: '${COLLECTOR_URL}',
                webApiUrl: '${webApiUrl}'
              });
              return; // Success, stop polling
            } catch (e) {
              console.error('No Name Analytics: Error during init:', e);
            }
          }
          
          if (attempts < maxAttempts) {
            setTimeout(checkInit, 100);
          } else {
            // Final fallback: try queue pattern if init never becomes available
            if (typeof window !== 'undefined' && typeof window.aa !== 'undefined') {
              try {
                window.aa('init', {
                  siteId: '${site.publicSiteId}',
                  key: '${site.publicWriteKey}',
                  endpoint: '${COLLECTOR_URL}',
                  webApiUrl: '${webApiUrl}'
                });
              } catch (e) {
                console.error('No Name Analytics: Error with queue pattern:', e);
              }
            } else {
              console.error('No Name Analytics: Script loaded but window.aa not available after ' + maxAttempts + ' attempts. Check browser console for errors.');
            }
          }
        };
        checkInit();
      }, 50); // Small delay to let the script execute
    };
    script.onerror = function() {
      console.error('No Name Analytics: Failed to load script from ${scriptUrl}');
    };
    // Also try immediate initialization if script already loaded
    if (typeof window.aa !== 'undefined' && typeof window.aa.init === 'function') {
      window.aa.init({
        siteId: '${site.publicSiteId}',
        key: '${site.publicWriteKey}',
        endpoint: '${COLLECTOR_URL}',
        webApiUrl: '${webApiUrl}'
      });
    }
    document.head.appendChild(script);
  })();
</script>
<!-- END NO NAME ANALYTICS -->
    `.trim();

    return NextResponse.json({
      script: installScript,
      scriptUrl,
      siteId: site.publicSiteId,
      writeKey: site.publicWriteKey,
    });
  } catch (error) {
    console.error('Error generating install script:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

