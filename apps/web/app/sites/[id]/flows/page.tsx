'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Info } from 'lucide-react';
import { getApiUrl } from '@/lib/api-client';

export const dynamic = 'force-dynamic';

interface FlowData {
  sourceRoute: string;
  totalSessions: number;
  totalConversions: number;
  totalExits: number;
  conversionRate: number;
  exitRate: number;
  destinations: Array<{
    targetRoute: string;
    sessionCount: number;
    conversionCount: number;
    exitCount: number;
    avgTransitionTime?: number;
    conversionRate: number;
    exitRate: number;
  }>;
}

interface FlowInsight {
  type: string;
  title: string;
  description: string;
  data: Array<{
    route: string;
    conversionRate?: number;
    exitRate?: number;
    sessionCount: number;
    fromRoute?: string;
    toRoute?: string;
    avgTransitionTime?: number;
  }>;
}

export default function FlowsPage() {
  const params = useParams();
  const siteId = params.id as string;
  const [flows, setFlows] = useState<FlowData[]>([]);
  const [insights, setInsights] = useState<FlowInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (siteId) {
      fetchFlows();
    }
  }, [siteId]);

  const fetchFlows = async () => {
    try {
      setLoading(true);
      const response = await fetch(getApiUrl(`/api/sites/${siteId}/flows?limit=20`));
      const data = await response.json();
      if (data.error) {
        setError(data.error);
      } else {
        setFlows(data.flows || []);
        setInsights(data.insights || []);
        setEnabled(data.enabled);
      }
      setLoading(false);
    } catch (err) {
      setError('Failed to load flows data');
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading flows data...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!enabled) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900 mb-4">Flows Analysis</h1>
            <Alert className="max-w-md mx-auto">
              <Info className="h-4 w-4" />
              <AlertDescription>
                Flows analysis is available. Generate some user activity to see flow patterns.
              </AlertDescription>
            </Alert>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900 mb-4">Flows Analysis</h1>
            <Alert className="max-w-md mx-auto">
              <AlertDescription className="text-red-600">{error}</AlertDescription>
            </Alert>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">User Flows Analysis</h1>
          <p className="text-gray-600">
            Analyze user journey patterns and route transitions to identify optimization
            opportunities.
          </p>
          <div className="mt-4">
            <Badge variant="default" className="bg-green-100 text-green-800">
              Flows Active
            </Badge>
          </div>
        </div>

        {/* Insights */}
        {insights.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Key Insights</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {insights.map((insight, index) => (
                <Card key={index}>
                  <CardHeader>
                    <CardTitle className="text-lg">{insight.title}</CardTitle>
                    <CardDescription>{insight.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {insight.data.slice(0, 3).map((item, itemIndex) => (
                        <div key={itemIndex} className="flex justify-between items-center text-sm">
                          <span className="truncate">
                            {item.fromRoute && item.toRoute
                              ? `${item.fromRoute} → ${item.toRoute}`
                              : item.route}
                          </span>
                          <div className="flex gap-2">
                            {item.conversionRate && (
                              <Badge variant="outline" className="text-xs">
                                {(item.conversionRate * 100).toFixed(1)}% conv
                              </Badge>
                            )}
                            {item.exitRate && (
                              <Badge variant="outline" className="text-xs">
                                {(item.exitRate * 100).toFixed(1)}% exit
                              </Badge>
                            )}
                            {item.avgTransitionTime && (
                              <Badge variant="outline" className="text-xs">
                                {Math.round(item.avgTransitionTime / 1000)}s
                              </Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Flows */}
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Flow Analysis</h2>
          {flows.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-gray-500">
                  No flow data available yet. Generate some user activity to see flow analysis.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {flows.map((flow, index) => (
                <Card key={index}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg">{flow.sourceRoute}</CardTitle>
                        <CardDescription>
                          {flow.totalSessions} sessions • {flow.totalConversions} conversions •{' '}
                          {flow.totalExits} exits
                        </CardDescription>
                      </div>
                      <div className="flex gap-2">
                        <Badge variant={flow.conversionRate > 0.1 ? 'default' : 'secondary'}>
                          {(flow.conversionRate * 100).toFixed(1)}% conversion
                        </Badge>
                        <Badge variant={flow.exitRate > 0.3 ? 'destructive' : 'outline'}>
                          {(flow.exitRate * 100).toFixed(1)}% exit
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <h4 className="font-medium text-gray-900">Destinations:</h4>
                      {flow.destinations.map((dest, destIndex) => (
                        <div
                          key={destIndex}
                          className="flex justify-between items-center p-3 bg-gray-50 rounded-lg"
                        >
                          <div>
                            <span className="font-medium">{dest.targetRoute}</span>
                            <p className="text-sm text-gray-600">
                              {dest.sessionCount} sessions
                              {dest.avgTransitionTime &&
                                ` • ${Math.round(dest.avgTransitionTime / 1000)}s avg`}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Badge variant="outline" className="text-xs">
                              {(dest.conversionRate * 100).toFixed(1)}% conv
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {(dest.exitRate * 100).toFixed(1)}% exit
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


