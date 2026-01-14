'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ExternalLink, AlertCircle, TrendingDown, Zap, MousePointerClick, FileText } from 'lucide-react';
import Link from 'next/link';

interface Problem {
  id: string;
  type: 'error_spike' | 'perf_slowdown' | 'funnel_drop' | 'ux_friction' | 'form_abandonment';
  severity: 'high' | 'medium' | 'low';
  title: string;
  description?: string;
  impactScore: number;
  affectedSessions: number;
  revenueImpact?: number | string;
  affectedRevenue?: number | string;
  costToFix?: number | string;
  status: 'active' | 'acknowledged' | 'resolved' | 'dismissed';
  firstSeen: string;
  lastSeen: string;
  evidence?: Array<{
    id: string;
    evidenceType: string;
    evidenceData: Record<string, any>;
    sampleSessionIds?: string[];
  }>;
  metadata?: Record<string, any>;
}

interface ProblemCardProps {
  problem: Problem;
  siteId: string;
}

const typeIcons = {
  error_spike: AlertCircle,
  perf_slowdown: TrendingDown,
  funnel_drop: TrendingDown,
  ux_friction: MousePointerClick,
  form_abandonment: FileText,
};

const severityColors = {
  high: 'destructive',
  medium: 'default',
  low: 'secondary',
} as const;

export function ProblemCard({ problem, siteId }: ProblemCardProps) {
  const Icon = typeIcons[problem.type] || AlertCircle;
  const severityColor = severityColors[problem.severity];

  // Get sample session IDs from evidence
  const sampleSessionIds = problem.evidence?.flatMap(e => e.sampleSessionIds || []) || [];
  const hasReplay = problem.metadata?.hasReplay || false;

  return (
    <Card className="mb-4">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <Icon className="h-5 w-5 mt-1 text-muted-foreground" />
            <div className="flex-1">
              <CardTitle className="text-lg">{problem.title}</CardTitle>
              <CardDescription className="mt-1">{problem.description}</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={severityColor}>{problem.severity}</Badge>
            <Badge variant="outline">{problem.status}</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div>
            <div className="text-sm text-muted-foreground">Impact Score</div>
            <div className="text-2xl font-bold">{Math.round(problem.impactScore).toLocaleString()}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Affected Sessions</div>
            <div className="text-2xl font-bold">{problem.affectedSessions.toLocaleString()}</div>
          </div>
          {problem.metadata?.conversionLift !== undefined && (
            <div>
              <div className="text-sm text-muted-foreground">Conversion Lift</div>
              <div className="text-2xl font-bold text-green-600">
                {problem.metadata.conversionLift >= 0 ? '+' : ''}
                {problem.metadata.conversionLift.toFixed(1)}pp
              </div>
              {problem.metadata.conversionLiftCI && (
                <div className="text-xs text-muted-foreground mt-1">
                  CI: [{problem.metadata.conversionLiftCI.lower.toFixed(1)}, {problem.metadata.conversionLiftCI.upper.toFixed(1)}]pp
                </div>
              )}
            </div>
          )}
          {problem.revenueImpact && (
            <div>
              <div className="text-sm text-muted-foreground">Revenue Impact</div>
              <div className="text-2xl font-bold text-red-600">
                ${Number(problem.revenueImpact).toLocaleString()}
              </div>
              {problem.metadata?.roi && (
                <div className="text-xs text-muted-foreground mt-1">
                  ROI: {Number(problem.metadata.roi).toFixed(1)}x
                </div>
              )}
            </div>
          )}
          {problem.costToFix && (
            <div>
              <div className="text-sm text-muted-foreground">Cost to Fix</div>
              <div className="text-2xl font-bold">
                ${Number(problem.costToFix).toLocaleString()}
              </div>
            </div>
          )}
          <div>
            <div className="text-sm text-muted-foreground">First Seen</div>
            <div className="text-sm">{new Date(problem.firstSeen).toLocaleDateString()}</div>
          </div>
        </div>

        {problem.evidence && problem.evidence.length > 0 && (
          <div className="mb-4 p-3 bg-muted rounded-md">
            <div className="text-sm font-medium mb-2">Evidence</div>
            {problem.evidence.map((ev, idx) => (
              <div key={idx} className="text-sm text-muted-foreground mb-1">
                {ev.evidenceType}: {JSON.stringify(ev.evidenceData).substring(0, 100)}...
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2 flex-wrap">
          {sampleSessionIds.length > 0 && (
            <Link href={`/sites/${siteId}/sessions?ids=${sampleSessionIds.slice(0, 10).join(',')}`}>
              <Button variant="outline" size="sm">
                <ExternalLink className="h-4 w-4 mr-2" />
                View Sample Sessions ({sampleSessionIds.length})
              </Button>
            </Link>
          )}
          {hasReplay && (
            <Link href={`/sites/${siteId}/recordings?problem=${problem.id}`}>
              <Button variant="outline" size="sm">
                <ExternalLink className="h-4 w-4 mr-2" />
                View Replay
              </Button>
            </Link>
          )}
          {problem.type === 'error_spike' && problem.metadata?.fingerprint && (
            <Link href={`/sites/${siteId}/errors/${problem.metadata.fingerprint}`}>
              <Button variant="outline" size="sm">
                View Error Details
              </Button>
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
