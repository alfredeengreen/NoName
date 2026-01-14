'use client';

import { ReactNode } from 'react';
import { ResponsiveContainer } from 'recharts';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface ChartContainerProps {
  children: ReactNode;
  height?: number;
  className?: string;
  loading?: boolean;
  error?: string | null;
}

export default function ChartContainer({
  children,
  height = 300,
  className,
  loading = false,
  error = null,
}: ChartContainerProps) {
  if (loading) {
    return (
      <Card className={cn(className)}>
        <CardContent className="p-6">
          <div className="flex items-center justify-center" style={{ height: `${height}px` }}>
            <Skeleton className="h-full w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={cn(className)}>
        <CardContent className="p-6">
          <div className="flex items-center justify-center" style={{ height: `${height}px` }}>
            <div className="text-destructive">Error: {error}</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn(className)}>
      <CardContent className="p-6">
        <ResponsiveContainer width="100%" height={height}>
          {children as React.ReactElement}
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

