/**
 * PagerDuty integration
 */

export interface PagerDutyConfig {
  integrationKey: string;
  severityMapping?: {
    high: string;
    medium: string;
    low: string;
  };
}

export async function createPagerDutyIncident(
  config: PagerDutyConfig,
  problem: {
    id: string;
    title: string;
    severity: 'high' | 'medium' | 'low';
    description?: string;
    impactScore: number;
  }
): Promise<{ incidentId: string; incidentUrl: string }> {
  const severity = config.severityMapping?.[problem.severity] || problem.severity;
  
  const payload = {
    routing_key: config.integrationKey,
    event_action: 'trigger',
    payload: {
      summary: problem.title,
      severity: severity,
      source: 'No Name Analytics',
      custom_details: {
        problemId: problem.id,
        impactScore: problem.impactScore,
        description: problem.description || '',
      },
    },
  };

  const response = await fetch('https://events.pagerduty.com/v2/enqueue', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`PagerDuty API error: ${response.statusText}`);
  }

  const result = await response.json() as { dedup_key?: string };
  return {
    incidentId: result.dedup_key || problem.id,
    incidentUrl: result.dedup_key ? `https://app.pagerduty.com/incidents/${result.dedup_key}` : '',
  };
}
