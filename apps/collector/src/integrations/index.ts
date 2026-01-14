/**
 * Integration orchestration
 */

import { getDb } from '@analytics/db';
import { integrations, alertRoutingRules, problems, sites } from '@analytics/db';
import { eq, and } from 'drizzle-orm';
import { createPagerDutyIncident } from './pagerduty.js';
import { sendSlackNotification } from './slack.js';

export interface IntegrationResult {
  success: boolean;
  integrationId: string;
  result?: any;
  error?: string;
}

/**
 * Process problem through integrations
 */
export async function processProblemIntegrations(
  siteId: string,
  problemId: string
): Promise<IntegrationResult[]> {
  const db = getDb();
  const results: IntegrationResult[] = [];

  // Get problem
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
    return results;
  }

  const p = problem[0];

  // Get site
  const site = await db
    .select()
    .from(sites)
    .where(eq(sites.id, siteId))
    .limit(1);

  const siteName = site.length > 0 ? site[0].name : 'Unknown';

  // Get org from site
  const orgId = site.length > 0 ? site[0].orgId : null;
  if (!orgId) {
    return results;
  }

  // Get enabled integrations
  const orgIntegrations = await db
    .select()
    .from(integrations)
    .where(
      and(
        eq(integrations.orgId, orgId),
        eq(integrations.enabled, true)
      )
    );

  // Get routing rules
  const rules = await db
    .select()
    .from(alertRoutingRules)
    .where(
      and(
        eq(alertRoutingRules.orgId, orgId),
        eq(alertRoutingRules.enabled, true)
      )
    );

  // Process each integration
  for (const integration of orgIntegrations) {
    // Check if routing rules match
    const matchingRule = rules.find(rule => {
      if (rule.integrationId !== integration.id) return false;
      const conditions = rule.conditions as any;
      if (conditions.problemType && !conditions.problemType.includes(p.type)) return false;
      if (conditions.severity && !conditions.severity.includes(p.severity)) return false;
      if (conditions.impactScoreMin && Number(p.impactScore) < conditions.impactScoreMin) return false;
      return true;
    });

    if (!matchingRule && rules.length > 0) {
      continue; // Skip if routing rules exist but none match
    }

    try {
      let result: any;

      switch (integration.type) {
        case 'pagerduty':
          result = await createPagerDutyIncident(
            integration.config as any,
            {
              id: p.id,
              title: p.title,
              severity: p.severity as 'high' | 'medium' | 'low',
              description: p.description || undefined,
              impactScore: Number(p.impactScore),
            }
          );
          break;

        case 'slack':
          await sendSlackNotification(
            integration.config as any,
            {
              id: p.id,
              title: p.title,
              severity: p.severity as 'high' | 'medium' | 'low',
              description: p.description || undefined,
              impactScore: Number(p.impactScore),
              affectedSessions: p.affectedSessions,
              siteName,
            }
          );
          result = { success: true };
          break;

        case 'webhook': {
          // Generic webhook
          const webhookResponse = await fetch((integration.config as any).url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...((integration.config as any).headers || {}),
            },
            body: JSON.stringify({
              event: 'problem_detected',
              problem: {
                id: p.id,
                title: p.title,
                severity: p.severity,
                description: p.description,
                impactScore: Number(p.impactScore),
                affectedSessions: p.affectedSessions,
              },
              site: {
                id: siteId,
                name: siteName,
              },
            }),
          });
          result = { success: webhookResponse.ok };
          break;
        }

        default:
          continue;
      }

      results.push({
        success: true,
        integrationId: integration.id,
        result,
      });
    } catch (error: any) {
      results.push({
        success: false,
        integrationId: integration.id,
        error: error.message,
      });
    }
  }

  return results;
}
