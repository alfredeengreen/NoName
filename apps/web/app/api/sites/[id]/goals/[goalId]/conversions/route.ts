import { NextRequest, NextResponse } from 'next/server';
import { getGoalConversions } from '@analytics/db/src/queries';
import { verifySiteAccess } from '@/lib/auth-helpers';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; goalId: string } }
) {
  try {
    const { authorized, site } = await verifySiteAccess(params.id);
    if (!authorized || !site) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const siteId = params.id;
    const goalId = params.goalId;
    const { searchParams } = new URL(request.url);
    const start = searchParams.get('start') ? new Date(searchParams.get('start')!) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = searchParams.get('end') ? new Date(searchParams.get('end')!) : new Date();

    const timeRange = { start, end };
    const data = await getGoalConversions(siteId, goalId, timeRange);

    // Ensure data is always an array
    return NextResponse.json(Array.isArray(data) ? data : []);
  } catch (error) {
    console.error('Error fetching goal conversions:', error);
    // Return empty array on error instead of error object
    return NextResponse.json([]);
  }
}

