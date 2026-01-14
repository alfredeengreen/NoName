'use client';

import { useParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
} from '@/components/ui/sidebar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { NavMain } from './nav-main';
import { NavUser } from './nav-user';
import Image from 'next/image';
import Link from 'next/link';
import { getApiUrl } from '@/lib/api-client';

interface Site {
  id: string;
  name: string;
  publicSiteId: string;
}

export function AppSidebar() {
  const params = useParams();
  const router = useRouter();
  const siteId = params.id as string;
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(getApiUrl('/api/sites'))
      .then((res) => res.json())
      .then((data) => {
        if (data.sites && Array.isArray(data.sites)) {
          setSites(data.sites);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleSiteChange = (value: string) => {
    router.push(`/sites/${value}/overview`);
  };

  const currentSite = sites.find((s) => s.id === siteId);
  // Use first available site if no siteId is selected, so site-specific links work
  const effectiveSiteId = siteId || (sites.length > 0 ? sites[0].id : '');

  return (
    <Sidebar>
      <SidebarHeader className="border-b">
        <div className="px-2 py-4">
          <Link href="/" className="flex items-center justify-center mb-4">
            <Image
              src="/nonameanalyticslogo.png"
              alt="No Name Analytics Logo"
              width={70}
              height={77}
              className="object-contain"
              unoptimized
            />
          </Link>
        </div>
        {!loading && sites.length > 0 && (
          <div className="px-2 py-2">
            <label className="text-xs font-semibold text-muted-foreground mb-2 block">
              Site
            </label>
            <Select value={siteId || ''} onValueChange={handleSiteChange}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select site">
                  {currentSite?.name || sites[0]?.name || 'Select site'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {sites.map((site) => (
                  <SelectItem key={site.id} value={site.id}>
                    {site.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </SidebarHeader>
      <SidebarContent>
        <NavMain siteId={effectiveSiteId} />
      </SidebarContent>
      <SidebarFooter className="border-t">
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  );
}

