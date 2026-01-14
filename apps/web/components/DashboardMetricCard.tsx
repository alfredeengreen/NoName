'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight, AlertTriangle, TrendingDown, ShoppingCart, Lightbulb, Users, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Area, AreaChart, ResponsiveContainer } from 'recharts';

interface DashboardMetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  icon?: React.ComponentType<{ className?: string }>;
  link?: string;
  linkLabel?: string;
  className?: string;
  variant?: 'default' | 'error' | 'warning' | 'success' | 'info';
  chartData?: Array<{ time: string; value: number }>;
}

const variantStyles = {
  default: 'border-gray-200',
  error: 'border-red-200 bg-red-50/50',
  warning: 'border-orange-200 bg-orange-50/50',
  success: 'border-green-200 bg-green-50/50',
  info: 'border-blue-200 bg-blue-50/50',
};

export default function DashboardMetricCard({
  title,
  value,
  subtitle,
  trend,
  icon: Icon,
  link,
  linkLabel,
  className,
  variant = 'default',
  chartData,
}: DashboardMetricCardProps) {
  const formattedValue = typeof value === 'number' ? value.toLocaleString() : value;
  const isPositive = trend?.isPositive ?? true;
  const changePercent = trend ? Math.abs(trend.value) : 0;

  // Prepare chart data if provided
  const chartDataFormatted = chartData?.map((item, index) => ({
    name: item.time || `Point ${index}`,
    value: item.value || 0,
  })) || [];

  return (
    <Card className={cn('hover:shadow-md transition-shadow', variantStyles[variant], className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardDescription className="text-sm font-medium">{title}</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex items-baseline gap-2">
            <CardTitle className="text-2xl font-bold">{formattedValue}</CardTitle>
            {trend && (
              <div className={cn("text-sm font-medium", isPositive ? 'text-green-600' : 'text-red-600')}>
                {isPositive ? '+' : ''}{changePercent.toFixed(1)}%
              </div>
            )}
          </div>
          {subtitle && (
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          )}
          {chartData && chartDataFormatted.length > 0 && (
            <div className="h-[60px] w-full mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartDataFormatted}>
                  <defs>
                    <linearGradient id={`gradient-${title.replace(/\s+/g, '-')}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="hsl(var(--primary))"
                    fill={`url(#gradient-${title.replace(/\s+/g, '-')})`}
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

