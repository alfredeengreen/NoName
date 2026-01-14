'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import { getApiUrl } from '@/lib/api-client';

interface AuditLogEntry {
  id: string;
  action: string;
  actionType: string;
  dimension?: string;
  reason?: string;
  count: number;
  metadata?: Record<string, any>;
  createdAt: string;
}

export default function AuditPage() {
  const params = useParams();
  const siteId = params.id as string;
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLogs();
  }, [siteId]);

  const fetchLogs = async () => {
    try {
      const res = await fetch(getApiUrl(`/api/sites/${siteId}/audit`));
      if (!res.ok) throw new Error('Failed to fetch audit logs');
      const data = await res.json();
      setLogs(data.logs || []);
    } catch (error) {
      console.error('Error fetching audit logs:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Audit Logs</h1>
        <p className="text-muted-foreground mt-1">
          View all data governance actions, drops, and mutations
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Last 100 audit log entries</CardDescription>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <div className="text-center p-8 text-muted-foreground">
              No audit logs found
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Dimension</TableHead>
                  <TableHead>Count</TableHead>
                  <TableHead>Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      {new Date(log.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{log.action}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{log.actionType}</Badge>
                    </TableCell>
                    <TableCell>{log.dimension || '-'}</TableCell>
                    <TableCell>{log.count}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {log.reason || '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
