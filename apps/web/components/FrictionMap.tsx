'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Filter } from 'lucide-react';

interface Insight {
  type: 'driver' | 'negative_impact' | 'exit_magnet' | 'banner_blindness' | 'path_bottleneck' | 'segment_issue' | 'variant_explanation';
  elementId: string;
  label?: string;
  role?: string;
  metrics: {
    lift_pp: number;
    exit_delta_pp: number;
    n: number;
    ctr: number;
    fi: number;
    lift_ci: [number, number];
    exit_ci: [number, number];
  };
  priority: number;
  recommendations: Array<{
    title: string;
    impact_estimate_pp: number;
    effort: number;
    rationale: string;
  }>;
  experiments: Array<{
    name: string;
    primary_metric: string;
    guardrails: string[];
    success: string;
  }>;
}

interface FrictionMapProps {
  insights: Insight[];
}

export default function FrictionMap({ insights }: FrictionMapProps) {
  const [showExitMagnetsOnly, setShowExitMagnetsOnly] = useState(false);
  const [excludeLowSupport, setExcludeLowSupport] = useState(false);

  // Filter insights based on settings
  const filteredInsights = insights.filter((insight) => {
    if (showExitMagnetsOnly && insight.type !== 'exit_magnet') return false;
    if (excludeLowSupport && insight.metrics.n < 20) return false;
    return true;
  });

  // Sort by Friction Index (highest first)
  const sortedInsights = [...filteredInsights].sort(
    (a, b) => b.metrics.fi - a.metrics.fi
  );

  // Transform data for bar chart
  const chartData = sortedInsights.slice(0, 20).map((insight) => ({
    name: insight.label || insight.elementId,
    elementId: insight.elementId,
    fi: insight.metrics.fi,
    lift: insight.metrics.lift_pp,
    exitDelta: insight.metrics.exit_delta_pp,
    sessions: insight.metrics.n,
    ctr: insight.metrics.ctr * 100,
    type: insight.type,
    role: insight.role,
    liftCI: [insight.metrics.lift_ci[0], insight.metrics.lift_ci[1]],
    exitCI: [insight.metrics.exit_ci[0], insight.metrics.exit_ci[1]],
  }));

  const getBarColor = (type: Insight['type']) => {
    switch (type) {
      case 'exit_magnet':
        return '#ef4444';
      case 'negative_impact':
        return '#f59e0b';
      case 'banner_blindness':
        return '#eab308';
      case 'path_bottleneck':
        return '#8b5cf6';
      case 'segment_issue':
        return '#3b82f6';
      default:
        return '#6b7280';
    }
  };

  if (!insights || insights.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <div className="space-y-4">
            <p className="text-gray-500 font-medium">No friction data available for visualization.</p>
            <div className="text-sm text-gray-400 space-y-2 max-w-md mx-auto">
              <p>
                To generate friction data, you need click events with element identifiers. The analytics script automatically captures clicks on elements that have:
              </p>
              <ul className="list-disc list-inside text-left space-y-1">
                <li><code className="bg-gray-100 px-1 rounded">data-element-id</code> attribute</li>
                <li><code className="bg-gray-100 px-1 rounded">id</code> attribute</li>
                <li><code className="bg-gray-100 px-1 rounded">data-testid</code> attribute</li>
                <li><code className="bg-gray-100 px-1 rounded">data-cy</code> attribute</li>
                <li>Or CSS class names (fallback)</li>
              </ul>
              <p className="pt-2">
                Click on interactive elements (buttons, links, forms) on your website to generate data. The friction map will appear once you have at least one element with multiple click sessions.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const maxFi = Math.max(...chartData.map((d) => d.fi));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Friction Map
          </CardTitle>
          <CardDescription>
            Elements ranked by Friction Index (FI). Higher values indicate more problematic elements.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex gap-4 mb-6">
            <Button
              variant={showExitMagnetsOnly ? 'default' : 'outline'}
              size="sm"
              onClick={() => setShowExitMagnetsOnly(!showExitMagnetsOnly)}
            >
              <Filter className="h-4 w-4 mr-2" />
              Exit Magnets Only
            </Button>
            <Button
              variant={excludeLowSupport ? 'default' : 'outline'}
              size="sm"
              onClick={() => setExcludeLowSupport(!excludeLowSupport)}
            >
              <Filter className="h-4 w-4 mr-2" />
              Exclude Low Support
            </Button>
          </div>

          {/* Chart */}
          <div className="h-96 border rounded-lg p-4 bg-gray-50">
            <div className="h-full flex flex-col">
              <div className="text-sm text-gray-600 mb-2 text-center">Friction Index</div>
              <div className="flex-1 space-y-2">
                {chartData.map((entry, index) => {
                  const widthPercent = (entry.fi / maxFi) * 100;

                  return (
                    <div key={index} className="flex items-center space-x-3">
                      <div
                        className="w-32 text-sm font-medium truncate"
                        title={entry.name}
                      >
                        {entry.name}
                      </div>
                      <div className="flex-1 relative">
                        <div className="h-6 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-300"
                            style={{
                              width: `${widthPercent}%`,
                              backgroundColor: getBarColor(entry.type),
                            }}
                          ></div>
                        </div>
                        <div className="absolute inset-0 flex items-center justify-end pr-2">
                          <span className="text-xs font-medium text-gray-700">
                            {entry.fi.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Friction Index Explanation */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Understanding Friction Index</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              The Friction Index (FI) combines multiple factors to identify problematic elements:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <h4 className="font-medium">Components:</h4>
                <ul className="text-sm space-y-1 text-gray-600">
                  <li>• <strong>Conversion Drop:</strong> Negative lift impact</li>
                  <li>• <strong>Exit Increase:</strong> Higher exit rates</li>
                  <li>• <strong>Hesitation:</strong> Time between exposure and click</li>
                  <li>• <strong>Rage Clicks:</strong> Multiple clicks without progression</li>
                </ul>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium">Interpretation:</h4>
                <ul className="text-sm space-y-1 text-gray-600">
                  <li>• <strong>FI &gt; 2.0:</strong> High friction - fix immediately</li>
                  <li>• <strong>FI 1.0-2.0:</strong> Moderate friction - investigate</li>
                  <li>• <strong>FI 0.0-1.0:</strong> Low friction - monitor</li>
                  <li>• <strong>FI &lt; 0.0:</strong> Positive impact - amplify</li>
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Top Friction Elements Table */}
      <Card>
        <CardHeader>
          <CardTitle>Top Friction Elements</CardTitle>
          <CardDescription>
            Detailed view of the most problematic elements
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Element</th>
                  <th className="text-left py-2">Type</th>
                  <th className="text-right py-2">FI</th>
                  <th className="text-right py-2">Lift (pp)</th>
                  <th className="text-right py-2">Exit Δ (pp)</th>
                  <th className="text-right py-2">Sessions</th>
                  <th className="text-right py-2">CTR</th>
                </tr>
              </thead>
              <tbody>
                {sortedInsights.slice(0, 10).map((insight, index) => (
                  <tr key={insight.elementId} className="border-b hover:bg-gray-50">
                    <td className="py-2">
                      <div>
                        <div className="font-medium">{insight.label || insight.elementId}</div>
                        {insight.role && (
                          <Badge variant="outline" className="text-xs mt-1">
                            {insight.role}
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="py-2">
                      <Badge
                        className="text-xs"
                        style={{ backgroundColor: getBarColor(insight.type) }}
                      >
                        {insight.type.replace('_', ' ')}
                      </Badge>
                    </td>
                    <td className="text-right py-2 font-semibold">
                      {insight.metrics.fi.toFixed(2)}
                    </td>
                    <td
                      className={`text-right py-2 ${
                        insight.metrics.lift_pp >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}
                    >
                      {insight.metrics.lift_pp >= 0 ? '+' : ''}
                      {insight.metrics.lift_pp.toFixed(2)}
                    </td>
                    <td
                      className={`text-right py-2 ${
                        insight.metrics.exit_delta_pp >= 0 ? 'text-red-600' : 'text-green-600'
                      }`}
                    >
                      {insight.metrics.exit_delta_pp >= 0 ? '+' : ''}
                      {insight.metrics.exit_delta_pp.toFixed(2)}
                    </td>
                    <td className="text-right py-2">
                      {insight.metrics.n.toLocaleString()}
                    </td>
                    <td className="text-right py-2">
                      {(insight.metrics.ctr * 100).toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

