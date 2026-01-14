import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { cookies } from 'next/headers';
import { getUserSites } from '@/lib/auth-helpers';
import { getCurrentUser } from '@/lib/auth-helpers';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get sites user has access to
    const sitesList = await getUserSites(user.id);

    // Format sites for response
    const sitesWithStats = sitesList.map((site) => ({
      id: site.id,
      name: site.name,
      publicSiteId: site.publicSiteId,
      lastEventTime: null, // Can be enhanced later
    }));

    return NextResponse.json({ sites: sitesWithStats });
  } catch (error) {
    console.error('Error fetching sites:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

