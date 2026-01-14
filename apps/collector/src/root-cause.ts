/**
 * Root cause analysis utilities
 * Identifies causal relationships and correlation chains
 */

import { getDb } from '@analytics/db';
import { correlations, problems, errors, errorEvents, performanceMetrics, eventsRaw } from '@analytics/db';
import { eq, and, sql, gte, desc } from 'drizzle-orm';

export interface CorrelationChain {
  problemId: string;
  chain: Array<{
    type: 'causes' | 'affected_by' | 'correlated';
    relatedProblemId: string;
    correlationStrength: number;
    description: string;
  }>;
  rootCause?: string; // Problem ID of the root cause
}

/**
 * Analyze correlation chains for a problem
 */
export async function analyzeCorrelationChains(
  siteId: string,
  problemId: string
): Promise<CorrelationChain> {
  const db = getDb();

  // Get the problem
  const problem = await db
    .select()
    .from(problems)
    .where(
      and(
        eq(problems.id, problemId),
        eq(problems.siteId, siteId)
      )
    )
    .limit(1);

  if (problem.length === 0) {
    throw new Error('Problem not found');
  }

  const p = problem[0];
  const chain: CorrelationChain['chain'] = [];

  // Find related problems based on correlations
  const relatedCorrelations = await db
    .select()
    .from(correlations)
    .where(
      and(
        eq(correlations.siteId, siteId),
        sql`related_problem_ids @> ${JSON.stringify([problemId])}::jsonb`
      )
    );

  // Get all problems that might be related
  const allProblems = await db
    .select()
    .from(problems)
    .where(
      and(
        eq(problems.siteId, siteId),
        eq(problems.status, 'active')
      )
    );

  // Analyze relationships
  for (const relatedProblem of allProblems) {
    if (relatedProblem.id === problemId) continue;

    // Check if problems are related by type, path, or time
    const relationship = analyzeProblemRelationship(p, relatedProblem);
    if (relationship) {
      chain.push(relationship);
    }
  }

  // Determine root cause (problem that causes others)
  const rootCause = findRootCause(chain, problemId);

  // Update correlation with causal relationship
  for (const corr of relatedCorrelations) {
    if (corr.relatedProblemIds && corr.relatedProblemIds.includes(problemId)) {
      await db
        .update(correlations)
        .set({
          causalRelationship: rootCause === problemId ? 'causes' : 'affected_by',
          relatedProblemIds: chain.map(c => c.relatedProblemId),
        })
        .where(eq(correlations.id, corr.id));
    }
  }

  return {
    problemId,
    chain: chain.sort((a, b) => b.correlationStrength - a.correlationStrength),
    rootCause,
  };
}

/**
 * Analyze relationship between two problems
 */
function analyzeProblemRelationship(
  problem1: any,
  problem2: any
): CorrelationChain['chain'][0] | null {
  // Check if they share paths
  const path1 = problem1.metadata?.path || '';
  const path2 = problem2.metadata?.path || '';
  const sharePath = path1 && path2 && path1 === path2;

  // Check if they're related by type
  const typeRelations: Record<string, string[]> = {
    error_spike: ['perf_slowdown', 'funnel_drop'],
    perf_slowdown: ['funnel_drop', 'ux_friction'],
    ux_friction: ['form_abandonment'],
  };

  const isTypeRelated = typeRelations[problem1.type]?.includes(problem2.type) || false;

  // Check temporal relationship (if problem1 started before problem2, it might cause it)
  const time1 = new Date(problem1.firstSeen).getTime();
  const time2 = new Date(problem2.firstSeen).getTime();
  const timeDiff = time2 - time1;
  const temporalRelationship = timeDiff > 0 && timeDiff < 24 * 60 * 60 * 1000; // Within 24 hours

  if (!sharePath && !isTypeRelated && !temporalRelationship) {
    return null;
  }

  // Determine relationship type
  let relationshipType: 'causes' | 'affected_by' | 'correlated' = 'correlated';
  if (timeDiff > 0 && (isTypeRelated || sharePath)) {
    relationshipType = 'causes';
  } else if (timeDiff < 0 && (isTypeRelated || sharePath)) {
    relationshipType = 'affected_by';
  }

  // Calculate correlation strength
  let strength = 0.5; // Base strength
  if (sharePath) strength += 0.2;
  if (isTypeRelated) strength += 0.2;
  if (temporalRelationship) strength += 0.1;

  return {
    type: relationshipType,
    relatedProblemId: problem2.id,
    correlationStrength: Math.min(strength, 1.0),
    description: `${problem1.type} ${relationshipType === 'causes' ? 'causes' : relationshipType === 'affected_by' ? 'is affected by' : 'correlates with'} ${problem2.type}`,
  };
}

/**
 * Find root cause in a correlation chain
 */
function findRootCause(
  chain: CorrelationChain['chain'],
  currentProblemId: string
): string | undefined {
  // Find problems that this one causes (indicating it's a root cause)
  const causes = chain.filter(c => c.type === 'causes');
  if (causes.length > 0) {
    return currentProblemId;
  }

  // Find the problem that causes this one
  const affectedBy = chain.filter(c => c.type === 'affected_by');
  if (affectedBy.length > 0) {
    // Recursively find root cause
    return affectedBy[0].relatedProblemId;
  }

  return undefined;
}

/**
 * Get root cause analysis for a problem
 */
export async function getRootCauseAnalysis(
  siteId: string,
  problemId: string
): Promise<{
  rootCause?: {
    problemId: string;
    title: string;
    type: string;
  };
  causes: Array<{
    problemId: string;
    title: string;
    type: string;
    strength: number;
  }>;
  affectedBy: Array<{
    problemId: string;
    title: string;
    type: string;
    strength: number;
  }>;
  correlated: Array<{
    problemId: string;
    title: string;
    type: string;
    strength: number;
  }>;
}> {
  const db = getDb();
  const chain = await analyzeCorrelationChains(siteId, problemId);

  const causes: any[] = [];
  const affectedBy: any[] = [];
  const correlated: any[] = [];

  for (const link of chain.chain) {
    const relatedProblem = await db
      .select()
      .from(problems)
      .where(eq(problems.id, link.relatedProblemId))
      .limit(1);

    if (relatedProblem.length > 0) {
      const p = relatedProblem[0];
      const item = {
        problemId: p.id,
        title: p.title,
        type: p.type,
        strength: link.correlationStrength,
      };

      if (link.type === 'causes') {
        causes.push(item);
      } else if (link.type === 'affected_by') {
        affectedBy.push(item);
      } else {
        correlated.push(item);
      }
    }
  }

  let rootCause;
  if (chain.rootCause) {
    const rootProblem = await db
      .select()
      .from(problems)
      .where(eq(problems.id, chain.rootCause))
      .limit(1);

    if (rootProblem.length > 0) {
      rootCause = {
        problemId: rootProblem[0].id,
        title: rootProblem[0].title,
        type: rootProblem[0].type,
      };
    }
  }

  return {
    rootCause,
    causes,
    affectedBy,
    correlated,
  };
}
