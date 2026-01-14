'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw, TrendingUp, TrendingDown } from 'lucide-react';
import { useParams } from 'next/navigation';
import { getApiUrl } from '@/lib/api-client';

interface JourneyData {
  elementId: string;
  label?: string;
  role?: string;
  convertCount: number;
  exitCount: number;
  convertRatio: number;
  exitRatio: number;
  difference: number;
  frictionIndex?: number;
}

interface JourneysResponse {
  convertJourney: JourneyData[];
  exitJourney: JourneyData[];
  topBottlenecks: Array<{
    elementId: string;
    label?: string;
    role?: string;
    convertFrequency: number;
    exitFrequency: number;
    ratio: number;
    description: string;
  }>;
  totalElements: number;
  totalSessions: number;
}

export default function JourneysView() {
  const params = useParams();
  const siteId = params.id as string;
  const [data, setData] = useState<JourneysResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchJourneyData = useCallback(async () => {
    try {
      setLoading(true);
      const url = getApiUrl(`/api/sites/${siteId}/journeys?minSessions=1&limit=50`);
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const journeyData = await response.json();
      setData(journeyData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [siteId]);

  useEffect(() => {
    fetchJourneyData();
  }, [fetchJourneyData]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="text-center py-12">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p className="text-gray-600">Loading journey data...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="text-center py-12">
            <p className="text-red-600 mb-4">{error}</p>
            <Button onClick={fetchJourneyData}>Retry</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) return null;

  // Show message if no journey data is available
  if (data.totalSessions === 0 || data.totalElements === 0) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="text-center py-12">
            <div className="text-gray-500 mb-4">
              <RefreshCw className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-medium mb-2">No Journey Data Available</h3>
              <p className="text-sm">
                Journey analysis requires sessions with click trails.
                <br />
                Generate some test data by clicking elements on your website.
              </p>
            </div>
            <Button onClick={fetchJourneyData} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Journey Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Convert Journey */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
              Convert Journey
            </CardTitle>
            <CardDescription>
              Elements that appear more frequently in converting sessions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.convertJourney.map((item, index) => (
                <div
                  key={item.elementId}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex-1">
                    <div className="font-medium">{item.label || item.elementId}</div>
                    <div className="flex gap-2 mt-1">
                      {item.role && (
                        <Badge variant="outline" className="text-xs">
                          {item.role}
                        </Badge>
                      )}
                      <Badge className="text-xs bg-green-100 text-green-800">
                        +{item.difference.toFixed(2)} advantage
                      </Badge>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-gray-600">
                      {item.convertCount} converts, {item.exitCount} exits
                    </div>
                    <div className="text-xs text-gray-500">
                      {(item.convertRatio * 100).toFixed(0)}% convert rate
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Exit Journey */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-red-600" />
              Exit Journey
            </CardTitle>
            <CardDescription>
              Elements that appear more frequently in exiting sessions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.exitJourney.map((item, index) => (
                <div
                  key={item.elementId}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex-1">
                    <div className="font-medium">{item.label || item.elementId}</div>
                    <div className="flex gap-2 mt-1">
                      {item.role && (
                        <Badge variant="outline" className="text-xs">
                          {item.role}
                        </Badge>
                      )}
                      <Badge className="text-xs bg-red-100 text-red-800">
                        FI: {item.frictionIndex?.toFixed(2) || 'N/A'}
                      </Badge>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-gray-600">
                      {item.convertCount} converts, {item.exitCount} exits
                    </div>
                    <div className="text-xs text-gray-500">
                      {(item.exitRatio * 100).toFixed(0)}% exit rate
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Unified Funnel View */}
      <Card>
        <CardHeader>
          <CardTitle>Conversion Funnel</CardTitle>
          <CardDescription>
            Unified view of user flow showing conversion events and drop-off points
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Funnel Steps */}
            <div className="relative">
              {/* Funnel visualization */}
              <div className="space-y-2">
                {/* Step 1: All Sessions */}
                <div className="flex items-center justify-between p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold">
                      1
                    </div>
                    <div>
                      <div className="font-medium">All Sessions</div>
                      <div className="text-sm text-gray-600">Users who started their journey</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-blue-600">
                      {data.totalSessions.toLocaleString()}
                    </div>
                    <div className="text-sm text-gray-600">100%</div>
                  </div>
                </div>

                {/* Step 2: Element Interactions */}
                <div className="flex items-center justify-between p-4 bg-purple-50 border border-purple-200 rounded-lg ml-8">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-purple-500 text-white rounded-full flex items-center justify-center text-sm font-bold">
                      2
                    </div>
                    <div>
                      <div className="font-medium">Element Interactions</div>
                      <div className="text-sm text-gray-600">
                        Users who clicked on tracked elements
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-purple-600">
                      {data.convertJourney.reduce((sum, item) => sum + item.convertCount + item.exitCount, 0) +
                        data.exitJourney.reduce((sum, item) => sum + item.convertCount + item.exitCount, 0)}
                    </div>
                    <div className="text-sm text-gray-600">
                      {(
                        ((data.convertJourney.reduce((sum, item) => sum + item.convertCount + item.exitCount, 0) +
                          data.exitJourney.reduce((sum, item) => sum + item.convertCount + item.exitCount, 0)) /
                          data.totalSessions) *
                        100
                      ).toFixed(1)}
                      %
                    </div>
                  </div>
                </div>

                {/* Step 3: Conversion Events */}
                <div className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-lg ml-16">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center text-sm font-bold">
                      3
                    </div>
                    <div>
                      <div className="font-medium">Conversion Events</div>
                      <div className="text-sm text-gray-600">
                        Users who completed conversion actions
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-green-600">
                      {data.convertJourney.reduce((sum, item) => sum + item.convertCount, 0)}
                    </div>
                    <div className="text-sm text-gray-600">
                      {(
                        (data.convertJourney.reduce((sum, item) => sum + item.convertCount, 0) /
                          data.totalSessions) *
                        100
                      ).toFixed(1)}
                      %
                    </div>
                  </div>
                </div>

                {/* Step 4: Exit Events */}
                <div className="flex items-center justify-between p-4 bg-red-50 border border-red-200 rounded-lg ml-16">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center text-sm font-bold">
                      4
                    </div>
                    <div>
                      <div className="font-medium">Exit Events</div>
                      <div className="text-sm text-gray-600">Users who left without converting</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-red-600">
                      {data.exitJourney.reduce((sum, item) => sum + item.exitCount, 0)}
                    </div>
                    <div className="text-sm text-gray-600">
                      {(
                        (data.exitJourney.reduce((sum, item) => sum + item.exitCount, 0) /
                          data.totalSessions) *
                        100
                      ).toFixed(1)}
                      %
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Top Bottlenecks */}
      {data.topBottlenecks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Top Bottlenecks</CardTitle>
            <CardDescription>
              Elements that appear significantly more in non-converting sessions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data.topBottlenecks.map((bottleneck, index) => (
                <div
                  key={bottleneck.elementId}
                  className="flex items-center justify-between p-4 border rounded-lg bg-red-50"
                >
                  <div className="flex-1">
                    <div className="font-medium">{bottleneck.label || bottleneck.elementId}</div>
                    <div className="flex gap-2 mt-1">
                      {bottleneck.role && (
                        <Badge variant="outline" className="text-xs">
                          {bottleneck.role}
                        </Badge>
                      )}
                      <Badge className="text-xs bg-red-200 text-red-800">
                        {bottleneck.ratio.toFixed(1)}× more in exits
                      </Badge>
                    </div>
                    <div className="text-sm text-gray-600 mt-2">{bottleneck.description}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm">
                      <span className="text-green-600">
                        {(bottleneck.convertFrequency * 100).toFixed(0)}%
                      </span>{' '}
                      converts
                    </div>
                    <div className="text-sm">
                      <span className="text-red-600">
                        {(bottleneck.exitFrequency * 100).toFixed(0)}%
                      </span>{' '}
                      exits
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Journey Analysis Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Journey Analysis Summary</CardTitle>
          <CardDescription>Key insights from path analysis</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center p-4 border rounded-lg bg-green-50">
              <div className="text-2xl font-bold text-green-600">{data.convertJourney.length}</div>
              <div className="text-sm text-green-800">Conversion Drivers</div>
              <div className="text-xs text-green-600 mt-1">Elements that help users convert</div>
            </div>

            <div className="text-center p-4 border rounded-lg bg-red-50">
              <div className="text-2xl font-bold text-red-600">{data.exitJourney.length}</div>
              <div className="text-sm text-red-800">Exit Magnets</div>
              <div className="text-xs text-red-600 mt-1">Elements that cause users to leave</div>
            </div>

            <div className="text-center p-4 border rounded-lg bg-orange-50">
              <div className="text-2xl font-bold text-orange-600">
                {data.topBottlenecks.length}
              </div>
              <div className="text-sm text-orange-800">Bottlenecks</div>
              <div className="text-xs text-orange-600 mt-1">Critical friction points</div>
            </div>
          </div>

          {/* Data Summary */}
          <div className="mt-6 pt-6 border-t">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
              <div>
                <strong>Total Sessions Analyzed:</strong> {data.totalSessions.toLocaleString()}
              </div>
              <div>
                <strong>Elements Tracked:</strong> {data.totalElements.toLocaleString()}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


