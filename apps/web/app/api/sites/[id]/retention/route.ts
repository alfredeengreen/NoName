import { NextRequest, NextResponse } from 'next/server';
import { getRetentionAnalysis, getRetentionTrends } from '@analytics/db/src/queries';
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
    const retentionDaysParam = searchParams.get('days') || '1,7,30';
    const retentionDays = retentionDaysParam.split(',').map((d) => parseInt(d.trim(), 10)).filter((d) => !isNaN(d));

    const timeRange = { start, end };
    const [retentionData, retentionTrends] = await Promise.all([
      getRetentionAnalysis(siteId, timeRange, retentionDays),
      getRetentionTrends(siteId, timeRange, retentionDays).catch(() => []),
    ]);

    return NextResponse.json({
      retention: Array.isArray(retentionData) ? retentionData : [],
      trends: Array.isArray(retentionTrends) ? retentionTrends : [],
    });
  } catch (error) {
    console.error('Error fetching retention analysis:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

