'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavItem {
  label: string;
  href: string;
  icon?: string;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

interface SiteNavigationProps {
  siteId: string;
}

export default function SiteNavigation({ siteId }: SiteNavigationProps) {
  const pathname = usePathname();

  const isActive = (href: string) => {
    return pathname === href || pathname?.startsWith(href + '/');
  };

  const navSections: NavSection[] = [
    {
      label: 'Reports',
      items: [
        { label: 'Overview', href: `/sites/${siteId}/overview` },
        { label: 'Dashboard', href: `/sites/${siteId}/dashboard` },
        { label: 'Realtime', href: `/sites/${siteId}/realtime` },
        { label: 'Problems', href: `/sites/${siteId}/problems` },
        { label: 'Insights', href: `/sites/${siteId}/insights` },
        { label: 'Impact Analysis', href: `/sites/${siteId}/impact` },
      ],
    },
    {
      label: 'Audience',
      items: [
        { label: 'Overview', href: `/sites/${siteId}/audience` },
        { label: 'Cohorts', href: `/sites/${siteId}/cohorts` },
        { label: 'Retention', href: `/sites/${siteId}/retention` },
        { label: 'Segments', href: `/sites/${siteId}/segments` },
      ],
    },
    {
      label: 'Acquisition',
      items: [
        { label: 'Overview', href: `/sites/${siteId}/acquisition` },
        { label: 'Attribution', href: `/sites/${siteId}/attribution` },
        { label: 'Multi-Channel Funnel', href: `/sites/${siteId}/mcf` },
      ],
    },
    {
      label: 'Behavior',
      items: [
        { label: 'Overview', href: `/sites/${siteId}/behavior` },
        { label: 'Funnels', href: `/sites/${siteId}/funnels` },
        { label: 'User Flows', href: `/sites/${siteId}/flows` },
      ],
    },
    {
      label: 'Conversions',
      items: [
        { label: 'Overview', href: `/sites/${siteId}/conversions` },
        { label: 'Goals', href: `/sites/${siteId}/goals` },
        { label: 'Lifetime Value', href: `/sites/${siteId}/ltv` },
      ],
    },
    {
      label: 'Events',
      items: [
        { label: 'Event Catalog', href: `/sites/${siteId}/events` },
      ],
    },
    {
      label: 'Configuration',
      items: [
        { label: 'Site Settings', href: `/sites/${siteId}/settings` },
        { label: 'Custom Dimensions', href: `/sites/${siteId}/dimensions` },
        { label: 'Calculated Metrics', href: `/sites/${siteId}/metrics` },
        { label: 'Custom Events', href: `/sites/${siteId}/custom-events` },
        { label: 'Alerts', href: `/sites/${siteId}/alerts` },
        { label: 'Scheduled Reports', href: `/sites/${siteId}/reports` },
      ],
    },
    {
      label: 'Developer Tools',
      items: [
        { label: 'Errors', href: `/sites/${siteId}/errors` },
        { label: 'Performance', href: `/sites/${siteId}/performance` },
      ],
    },
    {
      label: 'UI/UX Tools',
      items: [
        { label: 'Heatmaps', href: `/sites/${siteId}/heatmaps` },
        { label: 'Recordings', href: `/sites/${siteId}/recordings` },
        { label: 'Forms', href: `/sites/${siteId}/forms` },
        { label: 'Frustration Signals', href: `/sites/${siteId}/frustration` },
      ],
    },
    {
      label: 'Marketing',
      items: [
        { label: 'Campaigns', href: `/sites/${siteId}/marketing/campaigns` },
        { label: 'Landing Pages', href: `/sites/${siteId}/marketing/landing-pages` },
        { label: 'Content Performance', href: `/sites/${siteId}/marketing/content-performance` },
      ],
    },
    {
      label: 'Tools',
      items: [
        { label: 'Query Explorer', href: `/sites/${siteId}/explore` },
        { label: 'Data Import', href: `/sites/${siteId}/import` },
        { label: 'Data Export', href: `/sites/${siteId}/export` },
        { label: 'Audit Logs', href: `/sites/${siteId}/audit` },
      ],
    },
    {
      label: 'Admin',
      items: [
        { label: 'Dashboard', href: '/admin' },
        { label: 'Site Management', href: '/admin/sites' },
        { label: 'User Management', href: '/admin/users' },
        { label: 'Admin Tools', href: '/admin/tools' },
      ],
    },
  ];

  return (
    <nav className="w-64 bg-gray-50 border-r border-gray-200 h-full overflow-y-auto">
      <div className="p-4">
        {navSections.map((section, sectionIdx) => (
          <div key={sectionIdx} className="mb-6">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-3">
              {section.label}
            </h3>
            <ul className="space-y-1">
              {section.items.map((item) => {
                const active = isActive(item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`block px-3 py-2 text-sm rounded-md transition-colors ${
                        active
                          ? 'bg-blue-50 text-blue-700 font-medium'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  );
}

