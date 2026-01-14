import { NextRequest, NextResponse } from 'next/server';
import { getLTVAnalysis, getPredictiveLTV } from '@analytics/db/src/queries';
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

    const siteId = params.id;
    const { searchParams } = new URL(request.url);
    const start = searchParams.get('start') ? new Date(searchParams.get('start')!) : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const end = searchParams.get('end') ? new Date(searchParams.get('end')!) : new Date();
    const groupBy = (searchParams.get('groupBy') || 'channel') as 'channel' | 'segment' | 'cohort';

    const timeRange = { start, end };
    const [ltvData, predictiveLTV] = await Promise.all([
      getLTVAnalysis(siteId, timeRange, groupBy),
      getPredictiveLTV(siteId, timeRange, 30).catch(() => []),
    ]);

    return NextResponse.json({
      ltv: Array.isArray(ltvData) ? ltvData : [],
      predictive: Array.isArray(predictiveLTV) ? predictiveLTV : [],
    });
  } catch (error) {
    console.error('Error fetching LTV analysis:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

