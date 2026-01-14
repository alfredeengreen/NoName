'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Search, Loader2, Clock, Bookmark, Sparkles } from 'lucide-react';
import { parseQuery } from '@/lib/query-parser';
import QueryPreview from './QueryPreview';
import { cn } from '@/lib/utils';

interface SavedReport {
  id: string;
  name: string;
  queryText: string;
  queryConfig: any;
  createdAt: string;
}

interface DashboardSearchProps {
  className?: string;
  size?: 'default' | 'large';
}

export default function DashboardSearch({ className, size = 'large' }: DashboardSearchProps) {
  const params = useParams();
  const searchParams = useSearchParams();
  const siteId = params.id as string;
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [parsedQuery, setParsedQuery] = useState<any>(null);
  const [savedReports, setSavedReports] = useState<SavedReport[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load saved reports and recent searches
  useEffect(() => {
    if (siteId) {
      fetch(`/app/api/sites/${siteId}/search/saved`)
        .then((res) => res.json())
        .then((data) => {
          if (data.reports) {
            setSavedReports(data.reports);
          }
        })
        .catch(console.error);

      // Load recent searches from localStorage
      const recent = localStorage.getItem(`recent_searches_${siteId}`);
      if (recent) {
        setRecentSearches(JSON.parse(recent).slice(0, 5));
      }
    }
  }, [siteId]);

  const handleSearch = async (searchQuery: string) => {
    if (!searchQuery.trim()) return;

    setIsLoading(true);
    try {
      // Parse the query
      const parsed = parseQuery(searchQuery);
      setParsedQuery(parsed);

      // Save to recent searches
      const recent = recentSearches.filter((q) => q !== searchQuery);
      recent.unshift(searchQuery);
      setRecentSearches(recent.slice(0, 5));
      localStorage.setItem(`recent_searches_${siteId}`, JSON.stringify(recent.slice(0, 5)));

      // Show preview
      setIsOpen(true);
    } catch (error) {
      console.error('Error parsing query:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && query.trim()) {
      handleSearch(query);
    }
  };

  const handleSavedReportClick = (report: SavedReport) => {
    setQuery(report.queryText);
    handleSearch(report.queryText);
  };

  const getTimeRange = () => {
    const start = searchParams.get('start') || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const end = searchParams.get('end') || new Date().toISOString();
    return {
      start: new Date(start),
      end: new Date(end),
    };
  };

  const isLarge = size === 'large';
  const inputSize = isLarge ? 'h-14 text-lg' : 'h-10';

  return (
    <div className={cn('relative w-full', className)}>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <div className="relative">
            <Search className={cn(
              "absolute left-4 top-1/2 transform -translate-y-1/2 text-muted-foreground",
              isLarge ? "h-6 w-6" : "h-4 w-4"
            )} />
            <Input
              ref={inputRef}
              type="text"
              placeholder={isLarge ? "Search your analytics... (e.g., 'how many visitors on /page', 'show me errors', 'conversion rate')" : "Search analytics..."}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              className={cn(
                "pl-12 pr-12",
                inputSize,
                isLarge && "text-lg shadow-lg border-2 focus:border-primary"
              )}
            />
            {isLoading && (
              <Loader2 className={cn(
                "absolute right-4 top-1/2 transform -translate-y-1/2 animate-spin text-muted-foreground",
                isLarge ? "h-5 w-5" : "h-4 w-4"
              )} />
            )}
            {!isLoading && isLarge && (
              <div className="absolute right-4 top-1/2 transform -translate-y-1/2 flex items-center gap-1 text-xs text-muted-foreground">
                <Sparkles className="h-4 w-4" />
                <span>AI Search</span>
              </div>
            )}
          </div>
        </PopoverTrigger>
        <PopoverContent className={cn("p-0", isLarge ? "w-[700px]" : "w-[600px]")} align="start">
          {parsedQuery ? (
            <QueryPreview
              parsedQuery={parsedQuery}
              queryText={query}
              siteId={siteId}
              timeRange={getTimeRange()}
              onClose={() => {
                setIsOpen(false);
                setParsedQuery(null);
              }}
              onSave={() => {
                setIsOpen(false);
                setParsedQuery(null);
                // Reload saved reports
                fetch(`/app/api/sites/${siteId}/search/saved`)
                  .then((res) => res.json())
                  .then((data) => {
                    if (data.reports) {
                      setSavedReports(data.reports);
                    }
                  })
                  .catch(console.error);
              }}
            />
          ) : (
            <div className="p-4">
              {savedReports.length > 0 && (
                <div className="mb-4">
                  <div className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                    <Bookmark className="h-3 w-3" />
                    SAVED REPORTS
                  </div>
                  <div className="space-y-1">
                    {savedReports.slice(0, 5).map((report) => (
                      <button
                        key={report.id}
                        onClick={() => handleSavedReportClick(report)}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-muted rounded-md transition-colors"
                      >
                        <div className="font-medium">{report.name}</div>
                        <div className="text-xs text-muted-foreground">{report.queryText}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {recentSearches.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    RECENT SEARCHES
                  </div>
                  <div className="space-y-1">
                    {recentSearches.map((search, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          setQuery(search);
                          handleSearch(search);
                        }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-muted rounded-md transition-colors"
                      >
                        {search}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {savedReports.length === 0 && recentSearches.length === 0 && (
                <div className="text-sm text-muted-foreground text-center py-4">
                  <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>Start typing to search analytics data</p>
                  <p className="text-xs mt-2">Try: &quot;show me errors&quot;, &quot;conversion rate&quot;, &quot;top pages&quot;</p>
                </div>
              )}
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}

