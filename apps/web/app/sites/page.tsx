'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/app-sidebar';
import { SiteHeader } from '@/components/site-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { getApiUrl } from '@/lib/api-client';

interface Site {
  id: string;
  name: string;
  publicSiteId: string;
  lastEventTime: number | null;
}

export default function SitesPage() {
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(getApiUrl('/api/sites'))
      .then((res) => res.json())
      .then((data) => {
        setSites(data.sites || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold">Sites</h1>
            <Button asChild>
              <Link href="/sites/new">Create Site</Link>
            </Button>
          </div>
          {loading ? (
            <div className="grid gap-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : (
            <div className="grid gap-4">
              {sites.map((site) => (
                <Card key={site.id} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <CardTitle>
                      <Link href={`/sites/${site.id}`} className="hover:underline">
                        {site.name}
                      </Link>
                    </CardTitle>
                    <CardDescription>ID: {site.publicSiteId}</CardDescription>
                  </CardHeader>
                  {site.lastEventTime && (
                    <CardContent>
                      <p className="text-xs text-muted-foreground">
                        Last event: {new Date(site.lastEventTime * 1000).toLocaleString()}
                      </p>
                    </CardContent>
                  )}
                </Card>
              ))}
              {sites.length === 0 && (
                <Card>
                  <CardContent className="text-center py-12">
                    <p className="text-muted-foreground">
                      No sites yet. Create your first site to get started.
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

