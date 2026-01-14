'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Search, Loader2, Clock, Bookmark } from 'lucide-react';
import { parseQuery } from '@/lib/query-parser';
import QueryPreview from './QueryPreview';

interface SavedReport {
  id: string;
  name: string;
  queryText: string;
  queryConfig: any;
  createdAt: string;
}

export default function SearchBar() {
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

  return (
    <div className="relative flex-1 max-w-md">
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              ref={inputRef}
              type="text"
              placeholder="Search analytics... (e.g., 'how many visitors on /page')"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              className="pl-10 pr-10"
            />
            {isLoading && (
              <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>
        </PopoverTrigger>
        <PopoverContent className="w-[600px] p-0" align="start">
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
                  Start typing to search analytics data
                </div>
              )}
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}

