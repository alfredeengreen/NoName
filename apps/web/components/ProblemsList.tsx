'use client';

import { useState, useEffect } from 'react';
import { ProblemCard } from './ProblemCard';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { getApiUrl } from '@/lib/api-client';

interface Problem {
  id: string;
  type: 'error_spike' | 'perf_slowdown' | 'funnel_drop' | 'ux_friction' | 'form_abandonment';
  severity: 'high' | 'medium' | 'low';
  title: string;
  description?: string;
  impactScore: number;
  affectedSessions: number;
  revenueImpact?: number;
  affectedRevenue?: number;
  status: 'active' | 'acknowledged' | 'resolved' | 'dismissed';
  firstSeen: string;
  lastSeen: string;
  evidence?: Array<{
    id: string;
    evidenceType: string;
    evidenceData: Record<string, any>;
    sampleSessionIds?: string[];
  }>;
  metadata?: Record<string, any>;
}

interface ProblemsListProps {
  siteId: string;
}

export function ProblemsList({ siteId }: ProblemsListProps) {
  const [problems, setProblems] = useState<Problem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    type: 'all',
    severity: 'all',
    path: '',
    status: 'active',
  });

  useEffect(() => {
    fetchProblems();
  }, [siteId, filters]);

  const fetchProblems = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.type && filters.type !== 'all') params.append('type', filters.type);
      if (filters.severity && filters.severity !== 'all') params.append('severity', filters.severity);
      if (filters.path) params.append('path', filters.path);
      if (filters.status) params.append('status', filters.status);

      const res = await fetch(getApiUrl(`/api/sites/${siteId}/problems?${params.toString()}`));
      if (!res.ok) throw new Error('Failed to fetch problems');
      
      const data = await res.json();
      setProblems(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching problems:', error);
      setProblems([]);
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
    <div>
      <div className="mb-6 flex flex-wrap gap-4 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="text-sm font-medium mb-1 block">Type</label>
          <Select value={filters.type} onValueChange={(value) => setFilters({ ...filters, type: value })}>
            <SelectTrigger>
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="error_spike">Error Spike</SelectItem>
              <SelectItem value="perf_slowdown">Performance Slowdown</SelectItem>
              <SelectItem value="funnel_drop">Funnel Drop</SelectItem>
              <SelectItem value="ux_friction">UX Friction</SelectItem>
              <SelectItem value="form_abandonment">Form Abandonment</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex-1 min-w-[200px]">
          <label className="text-sm font-medium mb-1 block">Severity</label>
          <Select value={filters.severity} onValueChange={(value) => setFilters({ ...filters, severity: value })}>
            <SelectTrigger>
              <SelectValue placeholder="All severities" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All severities</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex-1 min-w-[200px]">
          <label className="text-sm font-medium mb-1 block">Status</label>
          <Select value={filters.status} onValueChange={(value) => setFilters({ ...filters, status: value })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="acknowledged">Acknowledged</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="dismissed">Dismissed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex-1 min-w-[200px]">
          <label className="text-sm font-medium mb-1 block">Path</label>
          <Input
            placeholder="Filter by path"
            value={filters.path}
            onChange={(e) => setFilters({ ...filters, path: e.target.value })}
          />
        </div>
      </div>

      {problems.length === 0 ? (
        <div className="text-center p-8 text-muted-foreground">
          No problems found. Your site is performing well!
        </div>
      ) : (
        <div>
          <div className="mb-4 text-sm text-muted-foreground">
            Showing {problems.length} problem{problems.length !== 1 ? 's' : ''} (ranked by impact score)
          </div>
          {problems.map((problem) => (
            <ProblemCard key={problem.id} problem={problem} siteId={siteId} />
          ))}
        </div>
      )}
    </div>
  );
}
