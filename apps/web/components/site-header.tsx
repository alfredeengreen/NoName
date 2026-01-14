'use client';

import { Suspense, useState } from 'react';
import { usePathname } from 'next/navigation';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Search, Command } from 'lucide-react';
import TimeRangeSelector from './TimeRangeSelector';
import SearchBar from './SearchBar';
import { CommandPalette } from './CommandPalette';
import { ThemeToggle } from './ThemeToggle';

export function SiteHeader() {
  const pathname = usePathname();
  const isDashboard = pathname?.includes('/dashboard');
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-2 border-b bg-background px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <div className="flex flex-1 items-center justify-between">
          <div className="flex items-center gap-4 flex-1">
            {!isDashboard && (
              <Suspense fallback={<div className="w-32 h-8" />}>
                <TimeRangeSelector />
              </Suspense>
            )}
            <Suspense fallback={<div className="w-64 h-10" />}>
              <SearchBar />
            </Suspense>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={() => setCommandPaletteOpen(true)}
            >
              <Command className="h-4 w-4" />
              <span className="sr-only">Open command palette</span>
            </Button>
            <ThemeToggle />
          </div>
        </div>
      </header>
      <CommandPalette open={commandPaletteOpen} onOpenChange={setCommandPaletteOpen} />
    </>
  );
}

