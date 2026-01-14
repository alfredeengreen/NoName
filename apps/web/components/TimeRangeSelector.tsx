'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export type TimeRangePreset = '1h' | '24h' | '7d' | '30d' | '90d' | 'custom';

export interface TimeRange {
  start: Date;
  end: Date;
  preset?: TimeRangePreset;
}

interface TimeRangeSelectorProps {
  onRangeChange?: (range: TimeRange) => void;
  defaultPreset?: TimeRangePreset;
}

export default function TimeRangeSelector({ onRangeChange, defaultPreset = '7d' }: TimeRangeSelectorProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [preset, setPreset] = useState<TimeRangePreset>(
    (searchParams.get('preset') as TimeRangePreset) || defaultPreset
  );
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');
  const [showCustom, setShowCustom] = useState(preset === 'custom');

  const getTimeRange = (presetValue: TimeRangePreset): TimeRange => {
    let end = new Date();
    let start = new Date();

    switch (presetValue) {
      case '1h':
        start = new Date(end.getTime() - 60 * 60 * 1000);
        break;
      case '24h':
        start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        start = new Date(end.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case 'custom':
        if (customStart && customEnd) {
          start = new Date(customStart);
          end = new Date(customEnd);
        } else {
          // Default to 7 days if custom dates not set
          start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
        }
        break;
    }

    return { start, end, preset: presetValue };
  };

  const updateURL = (newPreset: TimeRangePreset, range?: TimeRange) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('preset', newPreset);
    
    const timeRange = range || getTimeRange(newPreset);
    params.set('start', timeRange.start.toISOString());
    params.set('end', timeRange.end.toISOString());
    
    router.push(`${pathname}?${params.toString()}`);
  };

  const handlePresetChange = (newPreset: TimeRangePreset) => {
    setPreset(newPreset);
    setShowCustom(newPreset === 'custom');
    const range = getTimeRange(newPreset);
    updateURL(newPreset, range);
    onRangeChange?.(range);
  };

  const handleCustomDateChange = () => {
    if (customStart && customEnd) {
      const range = getTimeRange('custom');
      updateURL('custom', range);
      onRangeChange?.(range);
    }
  };

  useEffect(() => {
    // Initialize custom dates from URL if present
    const urlStart = searchParams.get('start');
    const urlEnd = searchParams.get('end');
    if (urlStart && urlEnd && preset === 'custom') {
      setCustomStart(new Date(urlStart).toISOString().split('T')[0]);
      setCustomEnd(new Date(urlEnd).toISOString().split('T')[0]);
    } else if (preset !== 'custom') {
      // Set default custom dates based on current preset
      const range = getTimeRange(preset);
      setCustomStart(range.start.toISOString().split('T')[0]);
      setCustomEnd(range.end.toISOString().split('T')[0]);
    }
  }, [preset, searchParams]);

  useEffect(() => {
    // Notify parent of initial range
    const range = getTimeRange(preset);
    onRangeChange?.(range);
  }, []);

  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-1 border rounded-md p-1 bg-background">
        <Button
          onClick={() => handlePresetChange('1h')}
          variant={preset === '1h' ? 'default' : 'ghost'}
          size="sm"
        >
          Last hour
        </Button>
        <Button
          onClick={() => handlePresetChange('24h')}
          variant={preset === '24h' ? 'default' : 'ghost'}
          size="sm"
        >
          24 hours
        </Button>
        <Button
          onClick={() => handlePresetChange('7d')}
          variant={preset === '7d' ? 'default' : 'ghost'}
          size="sm"
        >
          7 days
        </Button>
        <Button
          onClick={() => handlePresetChange('30d')}
          variant={preset === '30d' ? 'default' : 'ghost'}
          size="sm"
        >
          30 days
        </Button>
        <Button
          onClick={() => handlePresetChange('90d')}
          variant={preset === '90d' ? 'default' : 'ghost'}
          size="sm"
        >
          90 days
        </Button>
        <Button
          onClick={() => handlePresetChange('custom')}
          variant={preset === 'custom' ? 'default' : 'ghost'}
          size="sm"
        >
          Custom
        </Button>
      </div>

      {showCustom && (
        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={customStart}
            onChange={(e) => {
              setCustomStart(e.target.value);
              if (e.target.value && customEnd) {
                const range = {
                  start: new Date(e.target.value),
                  end: new Date(customEnd),
                  preset: 'custom' as TimeRangePreset,
                };
                updateURL('custom', range);
                onRangeChange?.(range);
              }
            }}
            className="w-auto"
          />
          <span className="text-muted-foreground text-sm">to</span>
          <Input
            type="date"
            value={customEnd}
            onChange={(e) => {
              setCustomEnd(e.target.value);
              if (customStart && e.target.value) {
                const range = {
                  start: new Date(customStart),
                  end: new Date(e.target.value),
                  preset: 'custom' as TimeRangePreset,
                };
                updateURL('custom', range);
                onRangeChange?.(range);
              }
            }}
            className="w-auto"
          />
        </div>
      )}
    </div>
  );
}

