'use client';

import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Loader2,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Target,
  Zap,
  BarChart3,
  Network,
  ScatterChart,
  Eye,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ImpactQuadrant from '@/components/ImpactQuadrant';
import FrictionMap from '@/components/FrictionMap';
import JourneysView from '@/components/JourneysView';
import { useOverlay } from '@/contexts/OverlayContext';
import { getApiUrl } from '@/lib/api-client';

export const dynamic = 'force-dynamic';

interface InsightMetrics {
  n: number;
  p0: number;
  p1: number;
  lift_pp: number;
  lift_ci: [number, number];
  q0: number;
  q1: number;
  exit_delta_pp: number;
  exit_ci: [number, number];
  ctr: number;
  exposure_sessions: number;
  fi: number;
}

interface InsightRecommendation {
  title: string;
  impact_estimate_pp: number;
  effort: number;
  rationale: string;
}

interface InsightExperiment {
  name: string;
  primary_metric: string;
  guardrails: string[];
  success: string;
}

interface Insight {
  type: 'driver' | 'negative_impact' | 'exit_magnet' | 'banner_blindness' | 'path_bottleneck' | 'segment_issue' | 'variant_explanation';
  elementId: string;
  label?: string;
  role?: string;
  metrics: InsightMetrics;
  segment: Record<string, any>;
  priority: number;
  recommendations: InsightRecommendation[];
  experiments: InsightExperiment[];
}

interface InsightsResponse {
  baseline: {
    sessions: number;
    conversions: number;
    conversionRate: number;
    exits: number;
    exitRate: number;
  };
  insights: Insight[];
  filters: Record<string, any>;
}

export default function InsightsDashboard() {
  const params = useParams();
  const searchParams = useSearchParams();
  const siteId = params.id as string;
  const [data, setData] = useState<InsightsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<{
    device?: string;
    userType?: string;
  }>({ device: 'all', userType: 'all' });
  const { toggleOverlay, isOverlayVisible } = useOverlay();

  const fetchInsights = async (currentFilters = filters) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        minSessions: '1',
        limit: '10',
        ...(currentFilters.device && currentFilters.device !== 'all' && { device: currentFilters.device }),
        ...(currentFilters.userType && currentFilters.userType !== 'all' && { userType: currentFilters.userType }),
      });

      const response = await fetch(getApiUrl(`/api/sites/${siteId}/insights?${params}`));
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const insightsData = await response.json();
      setData(insightsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch insights');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (siteId) {
      fetchInsights();
    }
  }, [siteId]);

  const handleFiltersChange = (newFilters: { device?: string; userType?: string }) => {
    setFilters(newFilters);
    fetchInsights(newFilters);
  };

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'driver':
        return <TrendingUp className="h-4 w-4 text-green-600" />;
      case 'negative_impact':
        return <TrendingDown className="h-4 w-4 text-red-600" />;
      case 'exit_magnet':
        return <AlertTriangle className="h-4 w-4 text-orange-600" />;
      case 'banner_blindness':
        return <Target className="h-4 w-4 text-blue-600" />;
      default:
        return <Zap className="h-4 w-4 text-purple-600" />;
    }
  };

  const getInsightBadgeColor = (type: string) => {
    switch (type) {
      case 'driver':
        return 'bg-green-100 text-green-800';
      case 'negative_impact':
        return 'bg-red-100 text-red-800';
      case 'exit_magnet':
        return 'bg-orange-100 text-orange-800';
      case 'banner_blindness':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-purple-100 text-purple-800';
    }
  };

  const formatPercentage = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(1)}pp`;
  };

  const formatConfidenceInterval = (ci: [number, number]) => {
    return `[${ci[0].toFixed(1)}, ${ci[1].toFixed(1)}]pp`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <span className="ml-2 text-gray-600">Loading insights...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <Alert className="bg-red-50 border-red-200">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800">
              <div className="space-y-2">
                <p className="font-semibold">Error loading insights: {error}</p>
                <Button
                  onClick={() => fetchInsights()}
                  variant="outline"
                  size="sm"
                  className="mt-2"
                >
                  Retry
                </Button>
                <p className="text-sm text-red-700 mt-2">
                  If this error persists, check your network connection and try refreshing the page.
                </p>
              </div>
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <Alert>
            <AlertDescription>
              <div className="space-y-2">
                <p className="font-semibold">No insights data available</p>
                <p className="text-sm">
                  Make sure you have some test data. Click on elements on your website to generate insights data.
                </p>
                <Button
                  onClick={() => fetchInsights()}
                  variant="outline"
                  size="sm"
                  className="mt-2"
                >
                  Refresh
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Insights Dashboard</h1>
          <Button
            variant={isOverlayVisible ? 'default' : 'outline'}
            onClick={() => {
              if (data?.insights) {
                toggleOverlay(data.insights as any);
              }
            }}
            disabled={!data?.insights || data.insights.length === 0}
          >
            <Eye className="h-4 w-4 mr-2" />
            {isOverlayVisible ? 'Exit Overlay' : 'Overlay Mode'}
          </Button>
        </div>

        {/* Header Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="bg-white rounded-lg shadow">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Conversion Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-blue-600">
                {((data.baseline?.conversionRate ?? 0) * 100).toFixed(2)}%
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {(data.baseline?.conversions ?? 0)} of {data.baseline?.sessions ?? 0} sessions
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white rounded-lg shadow">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Exit Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-red-600">
                {((data.baseline?.exitRate ?? 0) * 100).toFixed(2)}%
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {(data.baseline?.exits ?? 0)} of {data.baseline?.sessions ?? 0} sessions
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white rounded-lg shadow">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Sessions</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-gray-900">{data.baseline?.sessions ?? 0}</p>
              <p className="text-xs text-gray-500 mt-1">All tracked sessions</p>
            </CardContent>
          </Card>

          <Card className="bg-white rounded-lg shadow">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Active Elements</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-gray-900">{data.insights?.length ?? 0}</p>
              <p className="text-xs text-gray-500 mt-1">Elements with insights</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="insights" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="insights" className="flex items-center gap-2">
              <Target className="h-4 w-4" />
              Insights
            </TabsTrigger>
            <TabsTrigger value="quadrant" className="flex items-center gap-2">
              <ScatterChart className="h-4 w-4" />
              Impact Quadrant
            </TabsTrigger>
            <TabsTrigger value="friction" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Friction Map
            </TabsTrigger>
            <TabsTrigger value="journeys" className="flex items-center gap-2">
              <Network className="h-4 w-4" />
              Journeys
            </TabsTrigger>
          </TabsList>

          <TabsContent value="insights" className="space-y-6">
            <h2 className="text-2xl font-semibold text-gray-900">Element Insights</h2>

            {!data.insights || data.insights.length === 0 ? (
              <Card className="bg-white rounded-lg shadow p-6">
                <Alert>
                  <AlertDescription>
                    <div className="space-y-2">
                      <p>No insights available yet. To generate insights:</p>
                      <ul className="list-disc list-inside space-y-1 text-sm">
                        <li>Make sure the analytics script is installed on your site</li>
                        <li>Click on elements on your website to generate click events</li>
                        <li>Elements need at least {searchParams.get('minSessions') || '1'} session(s) to generate insights</li>
                        <li>Try clicking buttons, links, and interactive elements</li>
                      </ul>
                    </div>
                  </AlertDescription>
                </Alert>
              </Card>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {data.insights.map((insight, index) => (
                  <Card key={insight.elementId} className="bg-white rounded-lg shadow">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          {getInsightIcon(insight.type)}
                          <CardTitle className="text-lg">
                            {insight.label || insight.elementId}
                          </CardTitle>
                        </div>
                        <Badge className={getInsightBadgeColor(insight.type)}>
                          {insight.type.replace('_', ' ')}
                        </Badge>
                      </div>
                      {insight.role && (
                        <CardDescription className="text-sm text-gray-600">
                          Role: {insight.role}
                        </CardDescription>
                      )}
                    </CardHeader>

                    <CardContent className="space-y-4">
                      {/* Metrics */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm font-medium text-gray-600">Conversion Lift</p>
                          <p
                            className={`text-lg font-bold ${
                              insight.metrics.lift_pp >= 0 ? 'text-green-600' : 'text-red-600'
                            }`}
                          >
                            {formatPercentage(insight.metrics.lift_pp)}
                          </p>
                          <p className="text-xs text-gray-500">
                            CI: {formatConfidenceInterval(insight.metrics.lift_ci)}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-600">Exit Delta</p>
                          <p
                            className={`text-lg font-bold ${
                              insight.metrics.exit_delta_pp >= 0 ? 'text-red-600' : 'text-green-600'
                            }`}
                          >
                            {formatPercentage(insight.metrics.exit_delta_pp)}
                          </p>
                          <p className="text-xs text-gray-500">
                            CI: {formatConfidenceInterval(insight.metrics.exit_ci)}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm font-medium text-gray-600">Sessions</p>
                          <p className="text-lg font-bold text-gray-900">{insight.metrics.n}</p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-600">CTR</p>
                          <p className="text-lg font-bold text-gray-900">
                            {insight.metrics.ctr.toFixed(1)}%
                          </p>
                        </div>
                      </div>

                      {/* Recommendations */}
                      <div>
                        <h4 className="text-sm font-medium text-gray-600 mb-2">Recommendations</h4>
                        <div className="space-y-2">
                          {insight.recommendations.slice(0, 2).map((rec, recIndex) => (
                            <div key={recIndex} className="bg-gray-50 p-3 rounded-md">
                              <p className="text-sm font-medium text-gray-900">{rec.title}</p>
                              <p className="text-xs text-gray-600 mt-1">{rec.rationale}</p>
                              <div className="flex items-center justify-between mt-2">
                                <span className="text-xs text-blue-600">
                                  Impact: {formatPercentage(rec.impact_estimate_pp)}
                                </span>
                                <span className="text-xs text-gray-500">Effort: {rec.effort}/5</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Experiments */}
                      {insight.experiments.length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium text-gray-600 mb-2">Suggested Tests</h4>
                          <div className="space-y-2">
                            {insight.experiments.slice(0, 1).map((exp, expIndex) => (
                              <div key={expIndex} className="bg-blue-50 p-3 rounded-md">
                                <p className="text-sm font-medium text-blue-900">{exp.name}</p>
                                <p className="text-xs text-blue-700 mt-1">Success: {exp.success}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex space-x-2 pt-2">
                        <Button size="sm" variant="outline">
                          Copy Test Brief
                        </Button>
                        <Button size="sm" variant="outline">
                          View Details
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="quadrant">
            <ImpactQuadrant insights={data.insights as any} />
          </TabsContent>

          <TabsContent value="friction">
            <FrictionMap insights={data.insights as any} />
          </TabsContent>

          <TabsContent value="journeys">
            <JourneysView />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}


