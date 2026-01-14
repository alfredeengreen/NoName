'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Trash2, Play, Search } from 'lucide-react';
import Link from 'next/link';

interface SavedCustomReport {
  id: string;
  name: string;
  queryText: string;
  queryConfig: any;
  createdAt: string;
  updatedAt: string;
}

export default function CustomReportsPage() {
  const params = useParams();
  const router = useRouter();
  const siteId = params.id as string;
  const [reports, setReports] = useState<SavedCustomReport[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReports();
  }, [siteId]);

  const fetchReports = async () => {
    try {
      const res = await fetch(`/app/api/sites/${siteId}/search/saved`);
      if (!res.ok) {
        throw new Error('Failed to fetch reports');
      }
      const data = await res.json();
      setReports(data.reports || []);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching custom reports:', error);
      setReports([]);
      setLoading(false);
    }
  };

  const handleDelete = async (reportId: string) => {
    if (!confirm('Are you sure you want to delete this report?')) {
      return;
    }

    try {
      const res = await fetch(`/app/api/sites/${siteId}/search/saved?reportId=${reportId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        fetchReports();
      }
    } catch (error) {
      console.error('Error deleting report:', error);
      alert('Failed to delete report');
    }
  };

  const handleRun = (report: SavedCustomReport) => {
    const params = new URLSearchParams();
    params.set('query', JSON.stringify(report.queryConfig));
    if (report.queryConfig.timeRange) {
      params.set('start', new Date(report.queryConfig.timeRange.start).toISOString());
      params.set('end', new Date(report.queryConfig.timeRange.end).toISOString());
    }
    router.push(`/sites/${siteId}/explore?${params.toString()}`);
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-muted-foreground">Loading custom reports...</div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Saved Custom Reports</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Reports created from natural language searches
          </p>
        </div>
        <Link href={`/sites/${siteId}/explore`}>
          <Button>
            <Search className="mr-2 h-4 w-4" />
            Create New Report
          </Button>
        </Link>
      </div>

      {reports.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No saved reports yet</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Use the search bar in the header to create custom reports from natural language queries.
              </p>
              <Link href={`/sites/${siteId}/explore`}>
                <Button>
                  <Search className="mr-2 h-4 w-4" />
                  Go to Query Explorer
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {reports.map((report) => (
            <Card key={report.id}>
              <CardHeader>
                <CardTitle className="text-base">{report.name}</CardTitle>
                <CardDescription className="text-xs font-mono">
                  {report.queryText}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="text-xs text-muted-foreground">
                    <div>Metrics: {report.queryConfig.metrics?.join(', ') || 'None'}</div>
                    {report.queryConfig.dimensions && report.queryConfig.dimensions.length > 0 && (
                      <div>Dimensions: {report.queryConfig.dimensions.join(', ')}</div>
                    )}
                    {report.queryConfig.filters && report.queryConfig.filters.length > 0 && (
                      <div>Filters: {report.queryConfig.filters.length}</div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleRun(report)}
                      size="sm"
                      className="flex-1"
                    >
                      <Play className="mr-2 h-3 w-3" />
                      Run
                    </Button>
                    <Button
                      onClick={() => handleDelete(report.id)}
                      size="sm"
                      variant="destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Created {new Date(report.createdAt).toLocaleDateString()}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

