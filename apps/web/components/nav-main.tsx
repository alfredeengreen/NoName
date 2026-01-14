'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Activity,
  Users,
  UserCog,
  TrendingUp,
  MousePointerClick,
  ShoppingCart,
  Target,
  Calendar,
  Settings,
  AlertCircle,
  BarChart3,
  Zap,
  Code,
  Monitor,
  Video,
  FileText,
  AlertTriangle,
  Megaphone,
  FileSearch,
  Search,
  TrendingDown,
  Lightbulb,
  Network,
  Bug,
  Upload,
  Download,
  FileBarChart,
} from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';

interface NavItem {
  label: string;
  href: string;
  icon?: React.ComponentType<{ className?: string }>;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

interface NavMainProps {
  siteId: string;
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Overview: LayoutDashboard,
  Realtime: Activity,
  Cohorts: Users,
  Retention: Calendar,
  Segments: UserCog,
  Attribution: TrendingUp,
  'Multi-Channel Funnel': BarChart3,
  Funnels: MousePointerClick,
  Goals: Target,
  'Lifetime Value': ShoppingCart,
  'Event Catalog': Calendar,
  'Custom Dimensions': Settings,
  'Calculated Metrics': BarChart3,
  Alerts: AlertCircle,
  'Scheduled Reports': FileText,
  Errors: AlertTriangle,
  Performance: Zap,
  Heatmaps: Monitor,
  Recordings: Video,
  Forms: FileText,
  'Frustration Signals': AlertTriangle,
  Campaigns: Megaphone,
  'Content Performance': BarChart3,
  'Landing Pages': FileSearch,
  'Query Explorer': Search,
  Dashboard: LayoutDashboard,
  'Site Management': Settings,
  'User Management': Users,
  'Admin Tools': Settings,
  'Impact Analysis': TrendingDown,
  Insights: Lightbulb,
  Flows: Network,
  Problems: Bug,
  'Site Settings': Settings,
  'Data Import': Upload,
  'Data Export': Download,
  'Audit Logs': FileBarChart,
};

export function NavMain({ siteId }: NavMainProps) {
  const pathname = usePathname();

  const isActive = (href: string) => {
    return pathname === href || pathname?.startsWith(href + '/');
  };

  // Helper function to get the href for a site-specific link
  // If no siteId, link to /sites page to select a site first
  const getSiteHref = (path: string) => {
    if (!siteId) {
      return '/sites';
    }
    return `/sites/${siteId}${path}`;
  };

  // Show a visual indicator when on admin pages (no siteId) but still show all nav
  const isAdminPage = !siteId;

  // Consolidated navigation sections
  const navSections: NavSection[] = [
    {
      label: 'Dashboard',
      items: [
        { label: 'Dashboard', href: getSiteHref('/dashboard'), icon: LayoutDashboard },
        { label: 'Overview', href: getSiteHref('/overview'), icon: BarChart3 },
      ],
    },
    {
      label: 'Analytics',
      items: [
        { label: 'Realtime', href: getSiteHref('/realtime'), icon: Activity },
        { label: 'Audience', href: getSiteHref('/audience'), icon: Users },
        { label: 'Cohorts', href: getSiteHref('/cohorts'), icon: Users },
        { label: 'Retention', href: getSiteHref('/retention'), icon: Calendar },
        { label: 'Segments', href: getSiteHref('/segments'), icon: UserCog },
        { label: 'Acquisition', href: getSiteHref('/acquisition'), icon: TrendingUp },
        { label: 'Attribution', href: getSiteHref('/attribution'), icon: TrendingUp },
        { label: 'Multi-Channel Funnel', href: getSiteHref('/mcf'), icon: BarChart3 },
        { label: 'Behavior', href: getSiteHref('/behavior'), icon: MousePointerClick },
        { label: 'Conversions', href: getSiteHref('/conversions'), icon: ShoppingCart },
        { label: 'Goals', href: getSiteHref('/goals'), icon: Target },
        { label: 'Lifetime Value', href: getSiteHref('/ltv'), icon: ShoppingCart },
      ],
    },
    {
      label: 'Insights & Impact',
      items: [
        { label: 'Insights Dashboard', href: getSiteHref('/insights'), icon: Lightbulb },
        { label: 'Impact Analysis', href: getSiteHref('/impact'), icon: TrendingDown },
        { label: 'Problems', href: getSiteHref('/problems'), icon: Bug },
        { label: 'Funnels', href: getSiteHref('/funnels'), icon: MousePointerClick },
        { label: 'Flows', href: getSiteHref('/flows'), icon: Network },
      ],
    },
    {
      label: 'User Experience',
      items: [
        { label: 'Heatmaps', href: getSiteHref('/heatmaps'), icon: Monitor },
        { label: 'Recordings', href: getSiteHref('/recordings'), icon: Video },
        { label: 'Forms', href: getSiteHref('/forms'), icon: FileText },
        { label: 'Frustration Signals', href: getSiteHref('/frustration'), icon: AlertTriangle },
      ],
    },
    {
      label: 'Developer Tools',
      items: [
        { label: 'Errors', href: getSiteHref('/errors'), icon: AlertTriangle },
        { label: 'Performance', href: getSiteHref('/performance'), icon: Zap },
        { label: 'Event Catalog', href: getSiteHref('/events'), icon: Calendar },
        { label: 'Custom Events', href: getSiteHref('/custom-events'), icon: MousePointerClick },
      ],
    },
    {
      label: 'Marketing',
      items: [
        { label: 'Campaigns', href: getSiteHref('/marketing/campaigns'), icon: Megaphone },
        { label: 'Landing Pages', href: getSiteHref('/marketing/landing-pages'), icon: FileSearch },
        { label: 'Content Performance', href: getSiteHref('/marketing/content-performance'), icon: BarChart3 },
      ],
    },
    {
      label: 'Configuration',
      items: [
        { label: 'Site Settings', href: getSiteHref('/settings'), icon: Settings },
        { label: 'Custom Dimensions', href: getSiteHref('/dimensions'), icon: Settings },
        { label: 'Calculated Metrics', href: getSiteHref('/metrics'), icon: BarChart3 },
        { label: 'Alerts', href: getSiteHref('/alerts'), icon: AlertCircle },
        { label: 'Scheduled Reports', href: getSiteHref('/reports'), icon: FileText },
        { label: 'Query Explorer', href: getSiteHref('/explore'), icon: Search },
      ],
    },
    {
      label: 'Data Management',
      items: [
        { label: 'Data Import', href: getSiteHref('/import'), icon: Upload },
        { label: 'Data Export', href: getSiteHref('/export'), icon: Download },
        { label: 'Audit Logs', href: getSiteHref('/audit'), icon: FileBarChart },
      ],
    },
    {
      label: 'Admin',
      items: [
        { label: 'Dashboard', href: '/admin', icon: LayoutDashboard },
        { label: 'Site Management', href: '/admin/sites', icon: Settings },
        { label: 'User Management', href: '/admin/users', icon: Users },
        { label: 'Admin Tools', href: '/admin/tools', icon: Settings },
      ],
    },
  ];

  return (
    <SidebarGroup>
      <Accordion 
        type="multiple" 
        className="w-full"
        defaultValue={['Dashboard', 'Analytics']} // Open Dashboard and Analytics by default
      >
        {navSections.map((section) => (
          <AccordionItem key={section.label} value={section.label} className="border-none">
            <AccordionTrigger className="py-2 px-2 text-sm font-semibold hover:no-underline">
              <SidebarGroupLabel>{section.label}</SidebarGroupLabel>
            </AccordionTrigger>
            <AccordionContent className="pb-0">
              <SidebarMenu>
                {section.items.map((item) => {
                  const Icon = item.icon || iconMap[item.label] || LayoutDashboard;
                  const active = isActive(item.href);
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton asChild isActive={active}>
                        <Link href={item.href}>
                          <Icon className="h-4 w-4" />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </SidebarGroup>
  );
}

