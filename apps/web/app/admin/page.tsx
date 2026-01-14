'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/app-sidebar';
import { SiteHeader } from '@/components/site-header';
import MetricCard from '@/components/MetricCard';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { getApiUrl } from '@/lib/api-client';

interface AdminStats {
  sites: number;
  users: number;
  orgs: number;
  eventsToday: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(getApiUrl('/api/admin'))
      .then((res) => res.json())
      .then((data) => {
        if (data.stats) {
          setStats(data.stats);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold">Admin Dashboard</h1>
            <div className="flex gap-2">
              <Button asChild variant="outline">
                <Link href="/admin/sites">Manage Sites</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/admin/users">Manage Users</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/admin/tools">Admin Tools</Link>
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-32" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard
                title="Total Sites"
                value={stats?.sites || 0}
              />
              <MetricCard
                title="Total Users"
                value={stats?.users || 0}
              />
              <MetricCard
                title="Organizations"
                value={stats?.orgs || 0}
              />
              <MetricCard
                title="Events Today"
                value={stats?.eventsToday || 0}
              />
            </div>
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

