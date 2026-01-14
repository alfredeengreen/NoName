'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useParams } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  LayoutDashboard,
  Activity,
  Users,
  BarChart3,
  Settings,
  Search,
  FileText,
  AlertCircle,
  TrendingUp,
  MousePointerClick,
  Target,
  Video,
  Monitor,
  Zap,
  Calendar,
  Megaphone,
  FileSearch,
  Lightbulb,
  Network,
  ArrowRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Command {
  id: string;
  title: string;
  description?: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  category: string;
}

interface CommandPaletteProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function CommandPalette({ open: controlledOpen, onOpenChange }: CommandPaletteProps = {}) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const router = useRouter();
  const params = useParams();
  const siteId = params?.id as string | undefined;

  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const isControlled = controlledOpen !== undefined;

  // Build commands based on available siteId
  const commands: Command[] = React.useMemo(() => {
    const baseCommands: Command[] = [
      {
        id: 'dashboard',
        title: 'Dashboard',
        description: 'View main dashboard',
        href: siteId ? `/sites/${siteId}/dashboard` : '/admin',
        icon: LayoutDashboard,
        category: 'Navigation',
      },
      {
        id: 'overview',
        title: 'Overview',
        description: 'View site overview',
        href: siteId ? `/sites/${siteId}/overview` : '/admin',
        icon: BarChart3,
        category: 'Analytics',
      },
      {
        id: 'realtime',
        title: 'Realtime',
        description: 'View realtime analytics',
        href: siteId ? `/sites/${siteId}/realtime` : '/admin',
        icon: Activity,
        category: 'Analytics',
      },
      {
        id: 'audience',
        title: 'Audience',
        description: 'View audience analytics',
        href: siteId ? `/sites/${siteId}/audience` : '/admin',
        icon: Users,
        category: 'Analytics',
      },
      {
        id: 'insights',
        title: 'Insights Dashboard',
        description: 'View insights and recommendations',
        href: siteId ? `/sites/${siteId}/insights` : '/admin',
        icon: Lightbulb,
        category: 'Insights',
      },
      {
        id: 'funnels',
        title: 'Funnels',
        description: 'View funnel analysis',
        href: siteId ? `/sites/${siteId}/funnels` : '/admin',
        icon: MousePointerClick,
        category: 'Analytics',
      },
      {
        id: 'conversions',
        title: 'Conversions',
        description: 'View conversion data',
        href: siteId ? `/sites/${siteId}/conversions` : '/admin',
        icon: Target,
        category: 'Analytics',
      },
      {
        id: 'heatmaps',
        title: 'Heatmaps',
        description: 'View heatmap data',
        href: siteId ? `/sites/${siteId}/heatmaps` : '/admin',
        icon: Monitor,
        category: 'UX Tools',
      },
      {
        id: 'recordings',
        title: 'Recordings',
        description: 'View session recordings',
        href: siteId ? `/sites/${siteId}/recordings` : '/admin',
        icon: Video,
        category: 'UX Tools',
      },
      {
        id: 'errors',
        title: 'Errors',
        description: 'View error tracking',
        href: siteId ? `/sites/${siteId}/errors` : '/admin',
        icon: AlertCircle,
        category: 'Developer Tools',
      },
      {
        id: 'performance',
        title: 'Performance',
        description: 'View performance metrics',
        href: siteId ? `/sites/${siteId}/performance` : '/admin',
        icon: Zap,
        category: 'Developer Tools',
      },
      {
        id: 'explore',
        title: 'Query Explorer',
        description: 'Explore data with custom queries',
        href: siteId ? `/sites/${siteId}/explore` : '/admin',
        icon: Search,
        category: 'Tools',
      },
      {
        id: 'reports',
        title: 'Reports',
        description: 'View and manage reports',
        href: siteId ? `/sites/${siteId}/reports` : '/admin',
        icon: FileText,
        category: 'Tools',
      },
      {
        id: 'settings',
        title: 'Settings',
        description: 'Manage settings',
        href: '/settings',
        icon: Settings,
        category: 'Configuration',
      },
    ];

    return baseCommands;
  }, [siteId]);

  const filteredCommands = React.useMemo(() => {
    if (!search) return commands;
    const lowerSearch = search.toLowerCase();
    return commands.filter(
      (cmd) =>
        cmd.title.toLowerCase().includes(lowerSearch) ||
        cmd.description?.toLowerCase().includes(lowerSearch) ||
        cmd.category.toLowerCase().includes(lowerSearch)
    );
  }, [commands, search]);

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (isControlled && onOpenChange) {
          onOpenChange(!open);
        } else {
          setInternalOpen((prev) => !prev);
        }
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [isControlled, onOpenChange, open]);

  const handleSelect = (command: Command) => {
    router.push(command.href);
    if (isControlled && onOpenChange) {
      onOpenChange(false);
    } else {
      setInternalOpen(false);
    }
    setSearch('');
  };

  const groupedCommands = React.useMemo(() => {
    const groups: Record<string, Command[]> = {};
    filteredCommands.forEach((cmd) => {
      if (!groups[cmd.category]) {
        groups[cmd.category] = [];
      }
      groups[cmd.category].push(cmd);
    });
    return groups;
  }, [filteredCommands]);

  const handleOpenChange = (newOpen: boolean) => {
    if (isControlled && onOpenChange) {
      onOpenChange(newOpen);
    } else {
      setInternalOpen(newOpen);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="overflow-hidden p-0">
          <DialogDescription className="sr-only">
            Search for a command to run...
          </DialogDescription>
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <Input
              placeholder="Search for a command to run..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex h-12 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 border-0 focus-visible:ring-0"
            />
            <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100">
              <span className="text-xs">⌘</span>K
            </kbd>
          </div>
          <div className="max-h-[400px] overflow-y-auto p-2">
            {Object.keys(groupedCommands).length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                No commands found.
              </div>
            ) : (
              Object.entries(groupedCommands).map(([category, cmds]) => (
                <div key={category} className="mb-4">
                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                    {category}
                  </div>
                  {cmds.map((command) => {
                    const Icon = command.icon;
                    return (
                      <button
                        key={command.id}
                        onClick={() => handleSelect(command)}
                        className={cn(
                          'relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground'
                        )}
                      >
                        <Icon className="mr-2 h-4 w-4" />
                        <div className="flex flex-col flex-1 min-w-0">
                          <span className="font-medium">{command.title}</span>
                          {command.description && (
                            <span className="text-xs text-muted-foreground truncate">
                              {command.description}
                            </span>
                          )}
                        </div>
                        <ArrowRight className="ml-2 h-4 w-4 opacity-50" />
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

