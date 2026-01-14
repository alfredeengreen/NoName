'use client';

import { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { X, TrendingUp, TrendingDown, Users, MousePointer, AlertTriangle } from 'lucide-react';

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

interface OverlayProps {
  insights: Insight[];
  isVisible: boolean;
  onClose: () => void;
  siteId?: string;
}

interface HighlightedElement {
  elementId: string;
  insight: Insight;
  rect: DOMRect;
  element: HTMLElement;
}

export default function Overlay({ insights, isVisible, onClose, siteId }: OverlayProps) {
  const [highlightedElements, setHighlightedElements] = useState<HighlightedElement[]>([]);
  const [selectedElement, setSelectedElement] = useState<HighlightedElement | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Find and highlight elements on the page
  useEffect(() => {
    if (!isVisible) {
      setHighlightedElements([]);
      setSelectedElement(null);
      return;
    }

    const findElements = () => {
      const elements: HighlightedElement[] = [];

      insights.forEach((insight) => {
        // Try to find the element by various selectors
        const selectors = [
          `[data-element-id="${insight.elementId}"]`,
          insight.elementId.startsWith('#') ? insight.elementId : `#${insight.elementId}`,
          insight.elementId.startsWith('[') ? insight.elementId : `[id="${insight.elementId}"]`,
          `[data-testid="${insight.elementId}"]`,
          `[data-cy="${insight.elementId}"]`,
        ];

        for (const selector of selectors) {
          try {
            const element = document.querySelector(selector) as HTMLElement;
            if (element && element.offsetParent !== null) {
              // Check if element is visible
              const rect = element.getBoundingClientRect();
              if (rect.width > 0 && rect.height > 0) {
                elements.push({
                  elementId: insight.elementId,
                  insight,
                  rect,
                  element,
                });
                break;
              }
            }
          } catch (e) {
            // Invalid selector, try next
          }
        }
      });

      setHighlightedElements(elements);
    };

    // Initial find
    findElements();

    // Re-find on scroll and resize
    const handleUpdate = () => {
      findElements();
    };

    window.addEventListener('scroll', handleUpdate, { passive: true });
    window.addEventListener('resize', handleUpdate, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleUpdate);
      window.removeEventListener('resize', handleUpdate);
    };
  }, [isVisible, insights]);

  // Handle clicks on highlighted elements
  const handleElementClick = (highlightedElement: HighlightedElement, event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setSelectedElement(highlightedElement);
  };

  // Handle clicks on overlay background
  const handleOverlayClick = (event: React.MouseEvent) => {
    if (event.target === overlayRef.current) {
      setSelectedElement(null);
    }
  };

  const getInsightTypeColor = (type: Insight['type']) => {
    switch (type) {
      case 'driver':
        return 'bg-green-500/20 border-green-500';
      case 'negative_impact':
        return 'bg-red-500/20 border-red-500';
      case 'exit_magnet':
        return 'bg-orange-500/20 border-orange-500';
      case 'banner_blindness':
        return 'bg-yellow-500/20 border-yellow-500';
      case 'path_bottleneck':
        return 'bg-purple-500/20 border-purple-500';
      case 'segment_issue':
        return 'bg-blue-500/20 border-blue-500';
      case 'variant_explanation':
        return 'bg-indigo-500/20 border-indigo-500';
      default:
        return 'bg-gray-500/20 border-gray-500';
    }
  };

  const getInsightTypeLabel = (type: Insight['type']) => {
    switch (type) {
      case 'driver':
        return 'Driver';
      case 'negative_impact':
        return 'Negative Impact';
      case 'exit_magnet':
        return 'Exit Magnet';
      case 'banner_blindness':
        return 'Banner Blindness';
      case 'path_bottleneck':
        return 'Path Bottleneck';
      case 'segment_issue':
        return 'Segment Issue';
      case 'variant_explanation':
        return 'Variant Explanation';
      default:
        return 'Unknown';
    }
  };

  const formatLift = (lift: number) => {
    const sign = lift >= 0 ? '+' : '';
    return `${sign}${lift.toFixed(2)}pp`;
  };

  if (!isVisible) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm"
      onClick={handleOverlayClick}
    >
      {/* Highlighted Elements */}
      {highlightedElements.map((highlightedElement) => {
        const { rect, insight } = highlightedElement;
        const isSelected = selectedElement?.elementId === highlightedElement.elementId;

        return (
          <div
            key={highlightedElement.elementId}
            className={`absolute border-2 rounded-md cursor-pointer transition-all duration-200 ${
              isSelected
                ? 'border-blue-500 bg-blue-500/10 shadow-lg shadow-blue-500/25'
                : getInsightTypeColor(insight.type)
            }`}
            style={{
              left: rect.left + window.scrollX,
              top: rect.top + window.scrollY,
              width: rect.width,
              height: rect.height,
            }}
            onClick={(e) => handleElementClick(highlightedElement, e)}
          >
            {/* Element Label */}
            <div
              className={`absolute -top-8 left-0 px-2 py-1 text-xs font-medium rounded ${
                isSelected ? 'bg-blue-500 text-white' : 'bg-white text-gray-900 shadow-sm'
              }`}
            >
              {insight.label || insight.elementId}
            </div>

            {/* Impact Indicator */}
            <div
              className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-white ${
                insight.metrics.lift_pp >= 0 ? 'bg-green-500' : 'bg-red-500'
              }`}
            />
          </div>
        );
      })}

      {/* Selected Element Details */}
      {selectedElement && (
        <div
          className="absolute bg-white rounded-lg shadow-xl border max-w-sm"
          style={{
            left: Math.min(
              selectedElement.rect.left + window.scrollX + selectedElement.rect.width + 10,
              window.innerWidth - 400
            ),
            top: Math.min(
              selectedElement.rect.top + window.scrollY,
              window.innerHeight - 300
            ),
          }}
        >
          <Card className="border-0 shadow-none">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-lg">
                    {selectedElement.insight.label || selectedElement.insight.elementId}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge className={getInsightTypeColor(selectedElement.insight.type)}>
                      {getInsightTypeLabel(selectedElement.insight.type)}
                    </Badge>
                    {selectedElement.insight.role && (
                      <Badge variant="outline" className="text-xs">
                        {selectedElement.insight.role}
                      </Badge>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedElement(null)}
                  className="h-6 w-6 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Key Metrics */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-1 text-sm text-gray-600">
                    <TrendingUp className="h-4 w-4" />
                    Conversion Lift
                  </div>
                  <div
                    className={`text-lg font-semibold ${
                      selectedElement.insight.metrics.lift_pp >= 0
                        ? 'text-green-600'
                        : 'text-red-600'
                    }`}
                  >
                    {formatLift(selectedElement.insight.metrics.lift_pp)}
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-1 text-sm text-gray-600">
                    <TrendingDown className="h-4 w-4" />
                    Exit Delta
                  </div>
                  <div
                    className={`text-lg font-semibold ${
                      selectedElement.insight.metrics.exit_delta_pp >= 0
                        ? 'text-red-600'
                        : 'text-green-600'
                    }`}
                  >
                    {formatLift(selectedElement.insight.metrics.exit_delta_pp)}
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-1 text-sm text-gray-600">
                    <Users className="h-4 w-4" />
                    Sessions
                  </div>
                  <div className="text-lg font-semibold text-gray-900">
                    {selectedElement.insight.metrics.n.toLocaleString()}
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-1 text-sm text-gray-600">
                    <MousePointer className="h-4 w-4" />
                    CTR
                  </div>
                  <div className="text-lg font-semibold text-gray-900">
                    {(selectedElement.insight.metrics.ctr * 100).toFixed(2)}%
                  </div>
                </div>
              </div>

              {/* Top Recommendation */}
              {selectedElement.insight.recommendations.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Top Recommendation</h4>
                  <div className="text-sm">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <div className="font-medium">
                          {selectedElement.insight.recommendations[0].title}
                        </div>
                        <div className="text-gray-600 text-xs mt-1">
                          {selectedElement.insight.recommendations[0].rationale}
                        </div>
                        <div className="flex gap-2 mt-2">
                          <Badge variant="outline" className="text-xs">
                            {selectedElement.insight.recommendations[0].effort}/5 effort
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {formatLift(
                              selectedElement.insight.recommendations[0].impact_estimate_pp
                            )}{' '}
                            impact
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Overlay Controls */}
      <div className="absolute top-4 right-4 bg-white rounded-lg shadow-lg p-4">
        <div className="flex items-center gap-3">
          <div className="text-sm text-gray-600">
            {highlightedElements.length} elements highlighted
          </div>
          <Button variant="outline" size="sm" onClick={onClose}>
            <X className="h-4 w-4 mr-1" />
            Close Overlay
          </Button>
        </div>
      </div>
    </div>
  );
}


