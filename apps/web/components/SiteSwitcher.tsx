'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { getApiUrl } from '@/lib/api-client';

interface Site {
  id: string;
  name: string;
  publicSiteId: string;
}

export default function SiteSwitcher() {
  const router = useRouter();
  const params = useParams();
  const currentSiteId = params.id as string;
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

  const handleSiteChange = (siteId: string) => {
    router.push(`/sites/${siteId}/overview`);
  };

  if (loading || sites.length === 0) {
    return null;
  }

  const currentSite = sites.find((s) => s.id === currentSiteId);

  return (
    <div className="flex items-center gap-2">
      <label className="text-sm text-gray-600">Site:</label>
      <select
        value={currentSiteId || ''}
        onChange={(e) => handleSiteChange(e.target.value)}
        className="px-3 py-1 text-sm border border-gray-300 rounded-md bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {sites.map((site) => (
          <option key={site.id} value={site.id}>
            {site.name}
          </option>
        ))}
      </select>
    </div>
  );
}

