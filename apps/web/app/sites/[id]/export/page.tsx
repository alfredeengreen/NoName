'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Download } from 'lucide-react';
import { getApiUrl } from '@/lib/api-client';

export default function ExportPage() {
  const params = useParams();
  const siteId = params.id as string;
  const [exportType, setExportType] = useState<'events' | 'problems'>('events');
  const [exportFormat, setExportFormat] = useState<'csv' | 'json'>('csv');
  
  const getDateString = (date: Date) => {
    return date.toISOString().split('T')[0];
  };
  
  const [startDate, setStartDate] = useState(
    getDateString(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
  );
  const [endDate, setEndDate] = useState(getDateString(new Date()));
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleExport = async () => {
    setExporting(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        type: exportType,
        format: exportFormat,
        start: startDate,
        end: endDate,
      });

      const res = await fetch(getApiUrl(`/api/sites/${siteId}/export?${params.toString()}`));
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Export failed');
      }

      // Download the file
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${exportType}-${startDate}-to-${endDate}.${exportFormat}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Data Export</h1>
        <p className="text-muted-foreground mt-1">
          Export your analytics data in CSV or JSON format
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Export Configuration</CardTitle>
          <CardDescription>Select what to export and the date range</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Export Type</Label>
            <Select value={exportType} onValueChange={(value: 'events' | 'problems') => setExportType(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="events">Events</SelectItem>
                <SelectItem value="problems">Problems</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Format</Label>
            <Select value={exportFormat} onValueChange={(value: 'csv' | 'json') => setExportFormat(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="csv">CSV</SelectItem>
                <SelectItem value="json">JSON</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>End Date</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <Button onClick={handleExport} disabled={exporting} className="w-full">
            {exporting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Export Data
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
