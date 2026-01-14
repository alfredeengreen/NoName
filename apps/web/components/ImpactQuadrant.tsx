'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

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

interface ImpactQuadrantProps {
  insights: Insight[];
}

export default function ImpactQuadrant({ insights }: ImpactQuadrantProps) {
  const [selectedElement, setSelectedElement] = useState<Insight | null>(null);

  // Transform data for scatter plot
  const chartData = insights.map((insight) => ({
    ...insight,
    x: insight.metrics.lift_pp,
    y: Math.log10(insight.metrics.n + 1),
    size: Math.abs(insight.metrics.exit_delta_pp),
    confidence:
      insight.metrics.lift_ci[1] - insight.metrics.lift_ci[0] < 5 ? 1 : 0.5, // High confidence if CI < 5pp
  }));

  const getQuadrantColor = (lift: number, exitDelta: number) => {
    if (lift > 0 && exitDelta < 0) return '#10b981'; // Green - Do more
    if (lift < 0 && exitDelta > 0) return '#ef4444'; // Red - Fix now
    if (lift < 0 && exitDelta < 0) return '#f59e0b'; // Yellow - Investigate
    return '#6b7280'; // Gray - Ignore
  };

  const getQuadrantLabel = (lift: number, exitDelta: number) => {
    if (lift > 0 && exitDelta < 0) return 'Do More';
    if (lift < 0 && exitDelta > 0) return 'Fix Now';
    if (lift < 0 && exitDelta < 0) return 'Investigate';
    return 'Ignore';
  };

  if (!insights || insights.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <div className="space-y-2">
            <p className="text-gray-500 font-medium">No insights data available for visualization.</p>
            <p className="text-sm text-gray-400">
              Click on elements on your website to generate insights data. The quadrant will show once you have element interaction data.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Calculate bounds for positioning
  const minX = Math.min(...chartData.map((d) => d.x));
  const maxX = Math.max(...chartData.map((d) => d.x));
  const minY = Math.min(...chartData.map((d) => d.y));
  const maxY = Math.max(...chartData.map((d) => d.y));
  
  // Handle edge case where all X values are the same (add padding)
  const xRange = maxX - minX;
  const xPadding = xRange === 0 ? 1 : Math.max(1, xRange * 0.1);
  const adjustedMinX = minX - xPadding;
  const adjustedMaxX = maxX + xPadding;
  
  // Handle edge case where all Y values are the same (add padding)
  const yRange = maxY - minY;
  const yPadding = yRange === 0 ? 0.1 : Math.max(0.1, yRange * 0.1);
  const adjustedMinY = minY - yPadding;
  const adjustedMaxY = maxY + yPadding;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Impact Quadrant</CardTitle>
          <CardDescription>
            X-axis: Conversion Lift (pp), Y-axis: Log Sessions, Bubble Size: Exit Delta (pp)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-96 border rounded-lg p-4 bg-gray-50">
            <div className="h-full flex flex-col">
              {/* Y-axis label */}
              <div className="text-sm text-gray-600 mb-2 text-center">Log Sessions</div>

              {/* Chart area */}
              <div className="flex-1 relative border rounded bg-white">
                {/* Center line for X-axis (conversion lift = 0) */}
                {adjustedMinX <= 0 && adjustedMaxX >= 0 && (
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-gray-400 opacity-50 pointer-events-none z-0"
                    style={{
                      left: `${((0 - adjustedMinX) / (adjustedMaxX - adjustedMinX)) * 100}%`,
                    }}
                  />
                )}
                
                {chartData.map((entry, index) => {
                  // Map X to 0-100% where 0% = most negative, 100% = most positive
                  const xPercent = ((entry.x - adjustedMinX) / (adjustedMaxX - adjustedMinX)) * 100;
                  // Map Y to 0-100% where 0% = highest sessions, 100% = lowest sessions
                  const yPercent = ((adjustedMaxY - entry.y) / (adjustedMaxY - adjustedMinY)) * 100;

                  const bubbleSize = Math.max(8, Math.min(24, Math.abs(entry.size) / 5));

                  return (
                    <div
                      key={index}
                      className="absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer"
                      style={{
                        left: `${xPercent}%`,
                        top: `${yPercent}%`,
                        width: `${bubbleSize}px`,
                        height: `${bubbleSize}px`,
                        backgroundColor: getQuadrantColor(entry.x, entry.size),
                        opacity: entry.confidence,
                        borderRadius: '50%',
                        border: '2px solid white',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                        zIndex: 10,
                      }}
                      onClick={() => setSelectedElement(entry)}
                      title={`${entry.label || entry.elementId}: ${entry.x >= 0 ? '+' : ''}${entry.x.toFixed(1)}pp lift, ${entry.size >= 0 ? '+' : ''}${entry.size.toFixed(1)}pp exit delta, ${entry.metrics.n} sessions`}
                    />
                  );
                })}

                {/* Grid lines */}
                <div className="absolute inset-0 pointer-events-none z-0">
                  {/* Vertical lines */}
                  {[0, 25, 50, 75, 100].map((percent) => (
                    <div
                      key={`v-${percent}`}
                      className="absolute top-0 bottom-0 w-px bg-gray-200"
                      style={{ left: `${percent}%` }}
                    />
                  ))}
                  {/* Horizontal lines */}
                  {[0, 25, 50, 75, 100].map((percent) => (
                    <div
                      key={`h-${percent}`}
                      className="absolute left-0 right-0 h-px bg-gray-200"
                      style={{ top: `${percent}%` }}
                    />
                  ))}
                </div>
                
                {/* Axis value labels */}
                <div className="absolute -bottom-6 left-0 right-0 flex justify-between text-xs text-gray-500 pointer-events-none">
                  <span>{adjustedMinX.toFixed(1)}pp</span>
                  <span className="font-medium">0pp</span>
                  <span>{adjustedMaxX.toFixed(1)}pp</span>
                </div>
              </div>

              {/* X-axis label */}
              <div className="text-sm text-gray-600 mt-2 text-center">Conversion Lift (pp)</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quadrant Legend */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="text-center p-4 border rounded-lg bg-green-50">
          <div className="w-4 h-4 bg-green-500 rounded-full mx-auto mb-2"></div>
          <div className="font-medium text-green-800">Do More</div>
          <div className="text-sm text-green-600">Positive lift, low exits</div>
        </div>
        <div className="text-center p-4 border rounded-lg bg-red-50">
          <div className="w-4 h-4 bg-red-500 rounded-full mx-auto mb-2"></div>
          <div className="font-medium text-red-800">Fix Now</div>
          <div className="text-sm text-red-600">Negative lift, high exits</div>
        </div>
        <div className="text-center p-4 border rounded-lg bg-yellow-50">
          <div className="w-4 h-4 bg-yellow-500 rounded-full mx-auto mb-2"></div>
          <div className="font-medium text-yellow-800">Investigate</div>
          <div className="text-sm text-yellow-600">Negative lift, low exits</div>
        </div>
        <div className="text-center p-4 border rounded-lg bg-gray-50">
          <div className="w-4 h-4 bg-gray-500 rounded-full mx-auto mb-2"></div>
          <div className="font-medium text-gray-800">Ignore</div>
          <div className="text-sm text-gray-600">Neutral or low impact</div>
        </div>
      </div>

      {/* Selected Element Details */}
      {selectedElement && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Selected Element: {selectedElement.label || selectedElement.elementId}</span>
              <Badge
                style={{
                  backgroundColor: getQuadrantColor(
                    selectedElement.metrics.lift_pp,
                    selectedElement.metrics.exit_delta_pp
                  ),
                }}
              >
                {getQuadrantLabel(
                  selectedElement.metrics.lift_pp,
                  selectedElement.metrics.exit_delta_pp
                )}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="text-sm text-gray-600">Conversion Lift</div>
                <div
                  className={`text-lg font-semibold ${
                    selectedElement.metrics.lift_pp >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {selectedElement.metrics.lift_pp >= 0 ? '+' : ''}
                  {selectedElement.metrics.lift_pp.toFixed(2)}pp
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Exit Delta</div>
                <div
                  className={`text-lg font-semibold ${
                    selectedElement.metrics.exit_delta_pp >= 0 ? 'text-red-600' : 'text-green-600'
                  }`}
                >
                  {selectedElement.metrics.exit_delta_pp >= 0 ? '+' : ''}
                  {selectedElement.metrics.exit_delta_pp.toFixed(2)}pp
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Sessions</div>
                <div className="text-lg font-semibold">
                  {selectedElement.metrics.n.toLocaleString()}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600">CTR</div>
                <div className="text-lg font-semibold">
                  {(selectedElement.metrics.ctr * 100).toFixed(1)}%
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}


