import { NextRequest, NextResponse } from 'next/server';
import { getFlexibleFunnelData, getFunnelStepTiming, getFunnelDropOffDestinations } from '@analytics/db/src/queries';
import { getFunnelStepEvents, getFunnelElementContributions } from '@analytics/db/src/queries-funnels';
import { verifySiteAccess } from '@/lib/auth-helpers';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { authorized, site } = await verifySiteAccess(params.id);
    if (!authorized || !site) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const siteId = params.id;
    const body = await request.json();
    const { steps, start, end } = body;

    if (!steps || !Array.isArray(steps) || steps.length === 0) {
      return NextResponse.json({ error: 'Steps required' }, { status: 400 });
    }

    const timeRange = {
      start: start ? new Date(start) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      end: end ? new Date(end) : new Date(),
    };

    const [funnelData, stepTiming] = await Promise.all([
      getFlexibleFunnelData(siteId, steps, timeRange),
      getFunnelStepTiming(siteId, steps, timeRange),
    ]);

    // Get drop-off destinations for each step
    const dropOffDestinations = await Promise.all(
      steps.map((_, i) => 
        getFunnelDropOffDestinations(siteId, steps, i, timeRange, 5)
          .catch(() => []) // Gracefully handle errors
      )
    );

    // Get events for each step (grouped by session) - limit to first 5 steps to avoid performance issues
    const stepEvents = await Promise.all(
      steps.slice(0, 5).map((_, i) => 
        getFunnelStepEvents(siteId, steps, i, timeRange)
          .catch(() => []) // Gracefully handle errors
      )
    );

    // Get element contributions for each step
    const elementContributions = await Promise.all(
      steps.slice(0, steps.length - 1).map((_, i) =>
        getFunnelElementContributions(siteId, steps, i, timeRange)
          .catch(() => ({ topPositive: [], topNegative: [] })) // Gracefully handle errors
      )
    );

    // Enhance funnel data with element contributions
    const enhancedSteps = funnelData.steps.map((step: any, index: number) => ({
      ...step,
      elementContributions: elementContributions[index] || { topPositive: [], topNegative: [] },
    }));

    return NextResponse.json({
      ...funnelData,
      steps: enhancedSteps,
      stepTiming: Array.isArray(stepTiming) ? stepTiming : [],
      dropOffDestinations: Array.isArray(dropOffDestinations) ? dropOffDestinations : [],
      stepEvents: Array.isArray(stepEvents) ? stepEvents : [],
    });
  } catch (error) {
    console.error('Error fetching funnel data:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

