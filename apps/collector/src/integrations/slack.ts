/**
 * Slack integration
 */

export interface SlackConfig {
  webhookUrl: string;
  channel?: string;
  username?: string;
}

export async function sendSlackNotification(
  config: SlackConfig,
  problem: {
    id: string;
    title: string;
    severity: 'high' | 'medium' | 'low';
    description?: string;
    impactScore: number;
    affectedSessions: number;
    siteName: string;
  }
): Promise<void> {
  const severityColors: Record<string, string> = {
    high: '#ff0000',
    medium: '#ffaa00',
    low: '#00aa00',
  };

  const payload = {
    channel: config.channel,
    username: config.username || 'No Name Analytics',
    attachments: [
      {
        color: severityColors[problem.severity] || '#666666',
        title: problem.title,
        text: problem.description || '',
        fields: [
          {
            title: 'Severity',
            value: problem.severity.toUpperCase(),
            short: true,
          },
          {
            title: 'Impact Score',
            value: problem.impactScore.toLocaleString(),
            short: true,
          },
          {
            title: 'Affected Sessions',
            value: problem.affectedSessions.toLocaleString(),
            short: true,
          },
          {
            title: 'Site',
            value: problem.siteName,
            short: true,
          },
        ],
        footer: 'No Name Analytics',
        ts: Math.floor(Date.now() / 1000),
      },
    ],
  };

  const response = await fetch(config.webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Slack API error: ${response.statusText}`);
  }
}
