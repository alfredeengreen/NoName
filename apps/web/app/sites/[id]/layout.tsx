'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/app-sidebar';
import { SiteHeader } from '@/components/site-header';
import { Skeleton } from '@/components/ui/skeleton';
import Overlay from '@/components/Overlay';
import { useOverlay } from '@/contexts/OverlayContext';
import { getApiUrl } from '@/lib/api-client';

interface Site {
  name: string;
  publicSiteId: string;
}

export default function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams();
  const siteId = params.id as string;
  const [site, setSite] = useState<Site | null>(null);
  const [loading, setLoading] = useState(true);
  const { isOverlayVisible, insights, closeOverlay } = useOverlay();

  useEffect(() => {
    fetch(getApiUrl(`/api/sites/${siteId}`))
      .then((res) => {
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }
        return res.json();
      })
      .then((data) => setSite(data.site))
      .catch((error) => {
        console.error('Error fetching site:', error);
        setSite(null);
      })
      .finally(() => setLoading(false));
  }, [siteId]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Skeleton className="h-8 w-64" />
      </div>
    );
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
          {children}
        </div>
      </SidebarInset>
      <Overlay
        insights={insights as any}
        isVisible={isOverlayVisible}
        onClose={closeOverlay}
        siteId={siteId}
      />
    </SidebarProvider>
  );
}

