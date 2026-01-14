'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  comparison?: {
    current: number;
    previous: number;
    change: number;
    changePercent: number;
  };
  className?: string;
}

export default function MetricCard({ title, value, subtitle, trend, comparison, className }: MetricCardProps) {
  const formattedValue = typeof value === 'number' ? value.toLocaleString() : value;
  const showComparison = comparison !== undefined;

  // Calculate comparison if not provided
  const comparisonData = comparison || (trend ? {
    current: typeof value === 'number' ? value : 0,
    previous: typeof value === 'number' ? value : 0,
    change: 0,
    changePercent: trend.value,
  } : undefined);

  const isPositive = comparisonData ? comparisonData.changePercent >= 0 : (trend?.isPositive ?? true);
  const changePercent = comparisonData ? Math.abs(comparisonData.changePercent) : (trend ? Math.abs(trend.value) : 0);

  return (
    <Card className={cn(className)}>
      <CardHeader className="pb-2">
        <CardDescription>{title}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-2">
          <CardTitle className="text-2xl">{formattedValue}</CardTitle>
          {showComparison && comparisonData && (
            <div className={cn("text-sm font-medium", isPositive ? 'text-green-600' : 'text-red-600')}>
              {isPositive ? '↑' : '↓'} {changePercent.toFixed(1)}%
            </div>
          )}
        </div>
        {showComparison && comparisonData && (
          <div className="text-xs text-muted-foreground mt-1">
            vs previous period: {comparisonData.previous.toLocaleString()}
          </div>
        )}
        {subtitle && !showComparison && <div className="text-xs text-muted-foreground mt-1">{subtitle}</div>}
        {trend && !showComparison && (
          <div className={cn("text-xs mt-2", trend.isPositive ? 'text-green-600' : 'text-red-600')}>
            {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value).toFixed(1)}%
          </div>
        )}
      </CardContent>
    </Card>
  );
}

