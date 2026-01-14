'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { BarChart3, Eye } from 'lucide-react';
import { useOverlay } from '@/contexts/OverlayContext';
import { getApiUrl } from '@/lib/api-client';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

interface ImpactResponse {
  baseline: {
    sessions: number;
    conversions: number;
    conversionRate: number;
    exits: number;
    exitRate: number;
  };
  elements: Array<{
    elementId: string;
    label?: string;
    role?: string;
    sessions: number;
    conversions: number;
    exits: number;
    pConvGivenClick: number;
    pExitGivenClick: number;
    baseline: number;
    baselineExit: number;
    lift: number;
    exitLift: number;
    confidenceInterval: [number, number];
    isSignificant: boolean;
    isFriction: boolean;
  }>;
  frictionElements: Array<{
    elementId: string;
    label?: string;
    role?: string;
    sessions: number;
    exits: number;
    pExitGivenClick: number;
    baselineExit: number;
    exitLift: number;
    conversionDrop: number;
  }>;
}

export default function ImpactPage() {
  const params = useParams();
  const siteId = params.id as string;
  const [data, setData] = useState<ImpactResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<{
    device?: string;
    userType?: string;
  }>({ device: 'all', userType: 'all' });
  const { toggleOverlay, isOverlayVisible } = useOverlay();

  const fetchImpactData = async (currentFilters = filters) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        minSessions: '1',
        ...(currentFilters.device && currentFilters.device !== 'all' && { device: currentFilters.device }),
        ...(currentFilters.userType && currentFilters.userType !== 'all' && { userType: currentFilters.userType }),
      });

      const response = await fetch(getApiUrl(`/api/sites/${siteId}/impact?${params}`));
      if (!response.ok) {
        throw new Error('Failed to fetch impact data');
      }
      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (siteId) {
      fetchImpactData();
    }
  }, [siteId]);

  const handleFiltersChange = (newFilters: { device?: string; userType?: string }) => {
    setFilters(newFilters);
    fetchImpactData(newFilters);
  };

  const formatPercentage = (value: number) => `${(value * 100).toFixed(2)}%`;
  const formatLift = (lift: number) => {
    const sign = lift >= 0 ? '+' : '';
    return `${sign}${(lift * 100).toFixed(2)}pp`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading impact data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-red-600 text-xl mb-4 font-semibold">Error Loading Impact Data</div>
          <p className="text-gray-600 mb-4">{error}</p>
          <div className="space-y-2">
            <button
              onClick={() => fetchImpactData()}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              Retry
            </button>
            <p className="text-sm text-gray-500 mt-4">
              If this error persists, check your network connection and try refreshing the page.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Transform data for overlay (convert to insights format)
  const overlayInsights = data?.elements.map((el) => ({
    type: el.isFriction
      ? ('exit_magnet' as const)
      : el.lift > 0
      ? ('driver' as const)
      : ('negative_impact' as const),
    elementId: el.elementId,
    label: el.label,
    role: el.role,
    metrics: {
      lift_pp: el.lift * 100,
      exit_delta_pp: el.exitLift * 100,
      n: el.sessions,
      ctr: 0, // Not available in impact API
      fi: 0, // Not available in impact API
      lift_ci: [el.confidenceInterval[0] * 100, el.confidenceInterval[1] * 100] as [number, number],
      exit_ci: [0, 0] as [number, number],
    },
    priority: Math.abs(el.lift),
    recommendations: [],
    experiments: [],
  })) || [];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Impact Dashboard</h1>
              <p className="mt-2 text-gray-600">
                Baseline conversion across sampled sessions, and how each clicked element changes
                conversion likelihood. Positive lifts suggest drivers; negative lifts suggest
                friction. Data updates in real time.
              </p>
            </div>
            <div className="flex gap-3">
              <Link href={`/sites/${siteId}/insights`}>
                <Button variant="outline">
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Advanced Insights
                </Button>
              </Link>
              <Button
                variant={isOverlayVisible ? 'default' : 'outline'}
                onClick={() => {
                  if (overlayInsights.length > 0) {
                    toggleOverlay(overlayInsights as any);
                  }
                }}
                disabled={!overlayInsights || overlayInsights.length === 0}
              >
                <Eye className="h-4 w-4 mr-2" />
                {isOverlayVisible ? 'Exit Overlay' : 'Overlay Mode'}
              </Button>
            </div>
          </div>
        </div>

        {/* Header Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500">Baseline Conversion Rate</h3>
            <p className="text-3xl font-bold text-gray-900">
              {data ? formatPercentage(data.baseline.conversionRate) : '0.00%'}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500">Baseline Exit Rate</h3>
            <p className="text-3xl font-bold text-gray-900">
              {data ? formatPercentage(data.baseline.exitRate) : '0.00%'}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500">Total Sampled Sessions</h3>
            <p className="text-3xl font-bold text-gray-900">{data?.baseline.sessions || 0}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500">Elements Tracked</h3>
            <p className="text-3xl font-bold text-gray-900">{data?.elements.length || 0}</p>
          </div>
        </div>

        {/* Elements Table */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">Element Impact Analysis</h2>
            <p className="text-sm text-gray-500 mt-1">
              Elements ranked by absolute lift. Only elements with ≥1 session are shown.
            </p>
          </div>

          {!data || data.elements.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <div className="text-gray-400 text-6xl mb-4">📊</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Data Yet</h3>
              <p className="text-gray-500">
                The dashboard will show element impact data once you start tracking interactions.
                Embed the SDK on your site and begin collecting real user events.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Element
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Role
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Sessions
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Conv.
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Exits
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      P(conv|click)
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      P(exit|click)
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Lift
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {data.elements.map((element, index) => (
                    <tr
                      key={element.elementId}
                      className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <code className="text-sm font-mono text-gray-900 bg-gray-100 px-2 py-1 rounded">
                            {element.elementId}
                          </code>
                          {element.label && (
                            <div className="text-xs text-gray-500 mt-1 truncate max-w-32">
                              {element.label}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {element.role && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {element.role}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {element.sessions}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {element.conversions}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {element.exits}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatPercentage(element.pConvGivenClick)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatPercentage(element.pExitGivenClick)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span
                          className={`font-medium ${
                            element.lift > 0
                              ? 'text-green-600'
                              : element.lift < 0
                              ? 'text-red-600'
                              : 'text-gray-600'
                          }`}
                        >
                          {formatLift(element.lift)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div className="flex flex-col space-y-1">
                          {element.isSignificant && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                              Significant
                            </span>
                          )}
                          {element.isFriction && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                              Friction
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Friction Elements Table */}
        {data && data.frictionElements && data.frictionElements.length > 0 && (
          <div className="bg-white rounded-lg shadow mt-8">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900">Top Friction Elements</h2>
              <p className="text-sm text-gray-500 mt-1">
                Elements that significantly increase exit rates or decrease conversion rates.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Element
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Role
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Sessions
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Exits
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      P(exit|click)
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Exit Lift
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Conv. Drop
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {data.frictionElements.map((element, index) => (
                    <tr
                      key={element.elementId}
                      className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <code className="text-sm font-mono text-gray-900 bg-gray-100 px-2 py-1 rounded">
                            {element.elementId}
                          </code>
                          {element.label && (
                            <div className="text-xs text-gray-500 mt-1 truncate max-w-32">
                              {element.label}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {element.role && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {element.role}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {element.sessions}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {element.exits}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatPercentage(element.pExitGivenClick)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className="font-medium text-red-600">
                          {formatLift(element.exitLift)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className="font-medium text-red-600">
                          {formatLift(element.conversionDrop)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Refresh Button */}
        <div className="mt-6 text-center">
          <button
            onClick={() => fetchImpactData()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Refresh Data
          </button>
        </div>
      </div>
    </div>
  );
}


