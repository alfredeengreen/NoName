import { NextRequest, NextResponse } from 'next/server';
import { getCohortAnalysis, getCohortComparison } from '@analytics/db/src/queries';
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
    const cohortType = (searchParams.get('type') || 'acquisition') as 'acquisition' | 'event';
    const eventName = searchParams.get('event') || undefined;
    const start = searchParams.get('start') ? new Date(searchParams.get('start')!) : undefined;
    const end = searchParams.get('end') ? new Date(searchParams.get('end')!) : undefined;

    const timeRange = start && end ? { start, end } : undefined;

    const [cohortDataResult, cohortComparisonResult] = await Promise.allSettled([
      getCohortAnalysis(siteId, cohortType, eventName, timeRange),
      timeRange ? getCohortComparison(siteId, timeRange, cohortType, eventName).catch(() => []) : Promise.resolve([]),
    ]);

    // Extract results or use defaults
    const cohortData = cohortDataResult.status === 'fulfilled' 
      ? cohortDataResult.value 
      : { type: cohortType, cohorts: [] };
    const cohortComparison = cohortComparisonResult.status === 'fulfilled'
      ? (Array.isArray(cohortComparisonResult.value) ? cohortComparisonResult.value : [])
      : [];

    // Log errors for debugging
    if (cohortDataResult.status === 'rejected') {
      console.error('Error fetching cohort analysis:', cohortDataResult.reason);
    }
    if (cohortComparisonResult.status === 'rejected') {
      console.error('Error fetching cohort comparison:', cohortComparisonResult.reason);
    }

    return NextResponse.json({
      ...cohortData,
      comparison: cohortComparison,
    });
  } catch (error) {
    console.error('Error fetching cohort analysis:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

