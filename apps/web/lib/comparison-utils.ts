/**
 * Utility function to normalize comparison data from API
 * Handles both flat structure (current: number) and nested structure (current: { value: number })
 */
export function normalizeComparison(comparison: any): {
  current: number;
  previous: number;
  change: number;
  changePercent: number;
} | undefined {
  if (!comparison) return undefined;
  
  const getValue = (val: any): number => {
    if (typeof val === 'number') return val;
    if (typeof val === 'object' && val !== null && 'value' in val) return val.value;
    return 0;
  };

  return {
    current: getValue(comparison.current),
    previous: getValue(comparison.previous),
    change: comparison.change || 0,
    changePercent: comparison.changePercent || 0,
  };
}


