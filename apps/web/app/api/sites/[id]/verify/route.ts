import { NextRequest, NextResponse } from 'next/server';
import { verifySiteAccess } from '@/lib/auth-helpers';

const COLLECTOR_URL = process.env.COLLECTOR_URL || 'https://noname.fyi/collector';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { authorized, site } = await verifySiteAccess(params.id);
    if (!authorized || !site) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Call collector verify endpoint
    const verifyUrl = `${COLLECTOR_URL}/verify/${site.publicSiteId}`;
    const res = await fetch(verifyUrl);

    if (!res.ok) {
      return NextResponse.json({ error: 'Failed to verify' }, { status: 500 });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error verifying site:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

