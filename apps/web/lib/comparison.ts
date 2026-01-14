/**
 * Calculate previous period time range for comparison
 */
export function getPreviousPeriod(currentStart: Date, currentEnd: Date): { start: Date; end: Date } {
  const duration = currentEnd.getTime() - currentStart.getTime();
  const previousEnd = new Date(currentStart.getTime() - 1); // 1ms before current start
  const previousStart = new Date(previousEnd.getTime() - duration);
  
  return { start: previousStart, end: previousEnd };
}

/**
 * Calculate percentage change between two values
 */
export function calculateChange(current: number, previous: number): {
  change: number;
  changePercent: number;
} {
  if (previous === 0) {
    return {
      change: current,
      changePercent: current > 0 ? 100 : 0,
    };
  }
  
  const change = current - previous;
  const changePercent = (change / previous) * 100;
  
  return { change, changePercent };
}

/**
 * Format comparison data for display
 */
export function formatComparison(current: number, previous: number) {
  const { change, changePercent } = calculateChange(current, previous);
  return {
    current,
    previous,
    change,
    changePercent,
    isPositive: changePercent >= 0,
  };
}


