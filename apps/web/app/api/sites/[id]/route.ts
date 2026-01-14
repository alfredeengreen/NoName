import { NextRequest, NextResponse } from 'next/server';
import { verifySiteAccess } from '@/lib/auth-helpers';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { authorized, site } = await verifySiteAccess(params.id);
    if (!authorized || !site) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json({
      site: {
        id: site.id,
        name: site.name,
        publicSiteId: site.publicSiteId,
        publicWriteKey: site.publicWriteKey,
      },
    });
  } catch (error) {
    console.error('Error fetching site:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

