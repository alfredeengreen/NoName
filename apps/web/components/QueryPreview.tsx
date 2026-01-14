'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { parsedToQueryConfig, ParsedQuery } from '@/lib/query-parser';
import { Loader2, Play, Save, X } from 'lucide-react';

interface QueryPreviewProps {
  parsedQuery: ParsedQuery;
  queryText: string;
  siteId: string;
  timeRange: { start: Date; end: Date };
  onClose: () => void;
  onSave: () => void;
}

export default function QueryPreview({
  parsedQuery,
  queryText,
  siteId,
  timeRange,
  onClose,
  onSave,
}: QueryPreviewProps) {
  const router = useRouter();
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [reportName, setReportName] = useState('');

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const queryConfig = parsedToQueryConfig(parsedQuery, timeRange, siteId);
      
      // Navigate to explore page with query pre-filled
      const params = new URLSearchParams();
      params.set('query', JSON.stringify(queryConfig));
      params.set('start', timeRange.start.toISOString());
      params.set('end', timeRange.end.toISOString());
      
      router.push(`/sites/${siteId}/explore?${params.toString()}`);
      onClose();
    } catch (error) {
      console.error('Error generating report:', error);
      alert('Error generating report. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!reportName.trim()) {
      alert('Please enter a report name');
      return;
    }

    setIsSaving(true);
    try {
      const queryConfig = parsedToQueryConfig(parsedQuery, timeRange, siteId);
      
      const response = await fetch(`/app/api/sites/${siteId}/search/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: reportName.trim(),
          queryText,
          queryConfig,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save report');
      }

      setShowSaveDialog(false);
      setReportName('');
      onSave();
    } catch (error) {
      console.error('Error saving report:', error);
      alert('Error saving report. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-sm">Query Preview</h3>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <div className="text-xs text-muted-foreground mb-1">Your Query</div>
            <div className="text-sm font-mono bg-muted p-2 rounded">{queryText}</div>
          </div>

          <div>
            <div className="text-xs text-muted-foreground mb-1">Interpretation</div>
            <div className="text-sm">{parsedQuery.interpretation}</div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-muted-foreground mb-1">Metrics</div>
              <div className="text-sm">
                {parsedQuery.metrics.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {parsedQuery.metrics.map((m, idx) => (
                      <span key={idx} className="px-2 py-0.5 bg-primary/10 text-primary rounded text-xs">
                        {m.replace('_', ' ')}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-muted-foreground">None</span>
                )}
              </div>
            </div>

            <div>
              <div className="text-xs text-muted-foreground mb-1">Dimensions</div>
              <div className="text-sm">
                {parsedQuery.dimensions.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {parsedQuery.dimensions.map((d, idx) => (
                      <span key={idx} className="px-2 py-0.5 bg-secondary text-secondary-foreground rounded text-xs">
                        {d.replace('_', ' ')}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-muted-foreground">None</span>
                )}
              </div>
            </div>
          </div>

          {parsedQuery.filters.length > 0 && (
            <div>
              <div className="text-xs text-muted-foreground mb-1">Filters</div>
              <div className="space-y-1">
                {parsedQuery.filters.map((filter, idx) => (
                  <div key={idx} className="text-xs bg-muted p-2 rounded">
                    {filter.dimension && (
                      <span className="font-medium">{filter.dimension}</span>
                    )}
                    {filter.dimension && filter.operator && ' '}
                    {filter.operator && (
                      <span className="text-muted-foreground">{filter.operator}</span>
                    )}
                    {filter.operator && filter.value && ' '}
                    {filter.value && (
                      <span className="font-mono">{String(filter.value)}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {parsedQuery.timeContext && (
            <div>
              <div className="text-xs text-muted-foreground mb-1">Time Context</div>
              <div className="text-sm">{parsedQuery.timeContext.value}</div>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="flex-1"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Generate Report
                </>
              )}
            </Button>
            <Button
              onClick={() => setShowSaveDialog(true)}
              variant="outline"
              className="flex-1"
            >
              <Save className="mr-2 h-4 w-4" />
              Save Report
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Report</DialogTitle>
            <DialogDescription>
              Give your report a name so you can find it later.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="Report name (e.g., 'Visitors on Homepage')"
              value={reportName}
              onChange={(e) => setReportName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && reportName.trim()) {
                  handleSave();
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowSaveDialog(false);
                setReportName('');
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving || !reportName.trim()}>
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

