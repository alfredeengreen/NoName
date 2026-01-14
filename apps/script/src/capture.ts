import { batch } from './batch';
import { normalizeEventName, buildEventKey } from './eventkey';
import { setupErrorTracking as setupEnhancedErrorTracking } from './errorTracking';
import { setupPerformanceTracking as setupEnhancedPerformanceTracking } from './performance';
import { setupHeatmapTracking } from './heatmap';
import { setupFormAnalytics } from './formAnalytics';
import { setupFrustrationTracking } from './frustration';
import { setupSessionReplay } from './replay';

let lastPageviewTime = 0;
const PAGEVIEW_DEBOUNCE_MS = 500;

interface CustomEventTracker {
  eventName: string;
  value: string | null;
  cssSelector: string;
}

let customTrackers: CustomEventTracker[] = [];
let trackersLoaded = false;

export const capture = {
  setup() {
    // SPA navigation hooks
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = function (...args) {
      originalPushState.apply(history, args);
      capture.sendPageview();
    };

    history.replaceState = function (...args) {
      originalReplaceState.apply(history, args);
      capture.sendPageview();
    };

    window.addEventListener('popstate', () => capture.sendPageview());

    // Click capture
    document.addEventListener(
      'click',
      (e) => {
        const target = e.target as HTMLElement;
        const label = getClickLabel(target);
        const elementId = getElementSelector(target);
        
        // Always send click event with elementId for insights/impact analysis
        // even if label is missing, as long as we have an elementId
        if (elementId) {
          const eventKey = label ? buildEventKey('click', label) : `click:${elementId}`;
          
          // Send as named event with element metadata for impact analysis
          batch.sendEvent('click', {
            elementId,
            label: label || elementId, // Use elementId as fallback label
            eventKey,
          });
          
          // Also increment counter for aggregation (backward compatibility) if label exists
          if (label) {
            batch.increment(eventKey);
          }
        } else if (label) {
          // Fallback: if we have label but no elementId, still track for backward compatibility
          // Click without elementId
          const eventKey = buildEventKey('click', label);
          batch.increment(eventKey);
        } else {
          // Click without elementId or label
            element: target.tagName,
            className: target.className,
          });
        }
      },
      true // capture phase
    );

    // Form submit capture
    document.addEventListener(
      'submit',
      (e) => {
        const form = e.target as HTMLFormElement;
        if (form.tagName === 'FORM') {
          const label = getFormLabel(form);
          if (label) {
            const eventKey = buildEventKey('form_submit', label);
            batch.increment(eventKey);
          }
        }
      },
      true
    );

    // Outbound click capture
    document.addEventListener(
      'click',
      (e) => {
        const target = e.target as HTMLElement;
        const link = target.closest('a');
        if (link && link.href) {
          try {
            const linkUrl = new URL(link.href, window.location.href);
            const currentHost = window.location.hostname;
            if (linkUrl.hostname !== currentHost) {
              const eventKey = buildEventKey('outbound', linkUrl.hostname);
              batch.increment(eventKey);
            }
          } catch {
            // Invalid URL
          }
        }
      },
      true
    );

    // Scroll depth tracking
    setupScrollTracking();

    // Video engagement tracking
    setupVideoTracking();

    // File download tracking
    setupDownloadTracking();

    // Error tracking (enhanced)
    setupEnhancedErrorTracking();

    // Site search tracking
    setupSearchTracking();

    // Performance metrics (enhanced)
    setupEnhancedPerformanceTracking();
    
    // Heatmap tracking
    setupHeatmapTracking();
    
    // Form analytics
    setupFormAnalytics();
    
    // Frustration signals
    setupFrustrationTracking();
    
    // Session replay (hybrid)
    setupSessionReplay();
    
    // Custom event trackers
    setupCustomEventTrackers();
  },

  sendPageview() {
    const now = Date.now();
    if (now - lastPageviewTime < PAGEVIEW_DEBOUNCE_MS) {
      return;
    }
    lastPageviewTime = now;

    const path = window.location.pathname + window.location.search;
    const eventKey = `pv:${path}`;
    console.debug('No Name Analytics: Sending pageview', { path, eventKey });
    batch.increment(eventKey);
  },
};

function getElementSelector(element: HTMLElement): string {
  // Generate a stable selector for the element
  // Priority: data-element-id > id > data-testid > data-cy > CSS selector
  
  // Try data-element-id first (explicit tracking ID)
  const dataElementId = element.getAttribute('data-element-id');
  if (dataElementId) return dataElementId;

  // Try id
  if (element.id) return `#${element.id}`;

  // Try data-testid
  const testId = element.getAttribute('data-testid');
  if (testId) return `[data-testid="${testId}"]`;

  // Try data-cy (Cypress)
  const dataCy = element.getAttribute('data-cy');
  if (dataCy) return `[data-cy="${dataCy}"]`;

  // Generate CSS selector as fallback - always return something
  let selector = element.tagName.toLowerCase();
  
  // Try to use className
  if (element.className && typeof element.className === 'string') {
    const classes = element.className.trim().split(/\s+/).filter(c => c);
    if (classes.length > 0) {
      // Use first meaningful class (filter out utility classes)
      const meaningfulClass = classes.find(c => 
        !c.match(/^(w-|h-|p-|m-|text-|bg-|border-|rounded-|flex|grid|hidden|block|inline)/)
      ) || classes[0];
      selector = `${selector}.${meaningfulClass}`;
    }
  }

  // Add path context if possible (parent element)
  const parent = element.parentElement;
  if (parent) {
    if (parent.id) {
      selector = `#${parent.id} > ${selector}`;
    } else if (parent.className && typeof parent.className === 'string') {
      const parentClasses = parent.className.trim().split(/\s+/).filter(c => c);
      if (parentClasses.length > 0) {
        const parentClass = parentClasses[0];
        selector = `.${parentClass} > ${selector}`;
      }
    }
  }

  // If we still don't have a unique selector, add nth-child as last resort
  // But only if we have a parent to calculate position
  if (parent && selector === element.tagName.toLowerCase()) {
    const siblings = Array.from(parent.children).filter(
      (child) => child.tagName === element.tagName
    );
    if (siblings.length > 1) {
      const index = siblings.indexOf(element) + 1;
      selector = `${selector}:nth-of-type(${index})`;
    }
  }

  // Always return a selector - never null
  return selector;
}

function getClickLabel(element: HTMLElement): string | null {
  // Priority: data-analytics > id > name > aria-label > className > tagName:role
  const dataAnalytics = element.getAttribute('data-analytics');
  if (dataAnalytics) return normalizeEventName(dataAnalytics);

  const id = element.id;
  if (id) return normalizeEventName(id);

  const name = (element as HTMLInputElement).name;
  if (name) return normalizeEventName(name);

  const ariaLabel = element.getAttribute('aria-label');
  if (ariaLabel) return normalizeEventName(ariaLabel);

  // Include CSS classes
  const classList = element.className;
  if (classList && typeof classList === 'string' && classList.trim()) {
    // Take first meaningful class (avoid utility classes, prefer semantic classes)
    const classes = classList.trim().split(/\s+/).filter(cls => {
      // Filter out common utility patterns
      return cls && !cls.match(/^(w-|h-|p-|m-|text-|bg-|border-|rounded-|flex|grid|hidden)/);
    });
    if (classes.length > 0) {
      // Use first class or combine with tagName if multiple
      const className = classes.length === 1 ? classes[0] : classes.slice(0, 2).join('-');
      const tagName = element.tagName.toLowerCase();
      return normalizeEventName(`${tagName}.${className}`);
    }
  }

  const tagName = element.tagName.toLowerCase();
  const role = element.getAttribute('role') || 'default';
  return normalizeEventName(`${tagName}:${role}`);
}

function getFormLabel(form: HTMLFormElement): string | null {
  const dataAnalytics = form.getAttribute('data-analytics');
  if (dataAnalytics) return normalizeEventName(dataAnalytics);

  if (form.id) return normalizeEventName(form.id);
  if (form.name) return normalizeEventName(form.name);

  return null;
}

function setupScrollTracking() {
  const milestones = [25, 50, 75, 90, 100];
  const trackedMilestones = new Set<number>();
  let maxScroll = 0;

  const trackScroll = () => {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
    const scrollPercent = scrollHeight > 0 ? Math.round((scrollTop / scrollHeight) * 100) : 0;

    if (scrollPercent > maxScroll) {
      maxScroll = scrollPercent;
    }

    // Track milestones once
    for (const milestone of milestones) {
      if (scrollPercent >= milestone && !trackedMilestones.has(milestone)) {
        trackedMilestones.add(milestone);
        const eventKey = buildEventKey('scroll', milestone.toString());
        batch.increment(eventKey);
      }
    }
  };

  // Throttle scroll events
  let scrollTimeout: number | null = null;
  window.addEventListener('scroll', () => {
    if (scrollTimeout !== null) {
      clearTimeout(scrollTimeout);
    }
    scrollTimeout = window.setTimeout(trackScroll, 100);
  }, { passive: true });

  // Reset on page navigation (for SPAs)
  const resetScrollTracking = () => {
    trackedMilestones.clear();
    maxScroll = 0;
  };

  // Reset on pageview
  const originalSendPageview = capture.sendPageview;
  capture.sendPageview = function() {
    resetScrollTracking();
    originalSendPageview();
  };
}

function setupVideoTracking() {
  const videoProgressMilestones = [25, 50, 75, 90];
  const trackedVideos = new Map<HTMLVideoElement, Set<number>>();
  let videoObserver: MutationObserver | null = null;

  const trackVideoEvent = (video: HTMLVideoElement, eventType: string, progress?: number) => {
    const eventKey = progress !== undefined
      ? buildEventKey('video_progress', progress.toString())
      : buildEventKey('video', eventType);
    batch.increment(eventKey);
  };

  const handleVideoPlay = (e: Event) => {
    const video = e.target as HTMLVideoElement;
    trackVideoEvent(video, 'play');
  };

  const handleVideoProgress = (e: Event) => {
    const video = e.target as HTMLVideoElement;
    if (!video.duration) return;

    const progress = Math.round((video.currentTime / video.duration) * 100);
    let tracked = trackedVideos.get(video);
    if (!tracked) {
      tracked = new Set();
      trackedVideos.set(video, tracked);
    }

    for (const milestone of videoProgressMilestones) {
      if (progress >= milestone && !tracked.has(milestone)) {
        tracked.add(milestone);
        trackVideoEvent(video, 'progress', milestone);
      }
    }
  };

  const handleVideoComplete = (e: Event) => {
    const video = e.target as HTMLVideoElement;
    trackVideoEvent(video, 'complete');
    trackedVideos.delete(video);
  };

  // Wait for document.body to be available (script may load before DOM is ready)
  const setupVideoObserver = () => {
    // Check if document.body exists and is a valid Node (nodeType 1 = ELEMENT_NODE)
    if (!document.body || document.body.nodeType !== 1) {
      // Retry after a short delay
      setTimeout(setupVideoObserver, 50);
      return;
    }

    // Disconnect existing observer if any (for SPA navigation)
    if (videoObserver) {
      videoObserver.disconnect();
      videoObserver = null;
    }

    // Track existing videos
    document.querySelectorAll('video').forEach((video) => {
      video.addEventListener('play', handleVideoPlay);
      video.addEventListener('timeupdate', handleVideoProgress);
      video.addEventListener('ended', handleVideoComplete);
    });

    // Track dynamically added videos
    videoObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === 1) {
            const element = node as HTMLElement;
            if (element.tagName === 'VIDEO') {
              const video = element as HTMLVideoElement;
              video.addEventListener('play', handleVideoPlay);
              video.addEventListener('timeupdate', handleVideoProgress);
              video.addEventListener('ended', handleVideoComplete);
            }
            // Also check for videos in added subtree
            element.querySelectorAll('video').forEach((video) => {
              video.addEventListener('play', handleVideoPlay);
              video.addEventListener('timeupdate', handleVideoProgress);
              video.addEventListener('ended', handleVideoComplete);
            });
          }
        });
      });
    });

    // Double-check document.body is still valid before observing
    if (document.body && document.body.nodeType === 1) {
      try {
        videoObserver.observe(document.body, { childList: true, subtree: true });
      } catch (e) {
        // Failed to observe document.body
      }
    }
  };

  // Start setup (will wait for document.body if needed)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupVideoObserver);
  } else {
    setupVideoObserver();
  }
}

function setupDownloadTracking() {
  document.addEventListener(
    'click',
    (e) => {
      const target = e.target as HTMLElement;
      const link = target.closest('a');
      if (link && link.href) {
        try {
          const url = new URL(link.href);
          const pathname = url.pathname.toLowerCase();
          const downloadExtensions = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.zip', '.rar', '.tar', '.gz', '.csv', '.txt', '.mp3', '.mp4', '.avi', '.mov', '.jpg', '.jpeg', '.png', '.gif'];
          
          for (const ext of downloadExtensions) {
            if (pathname.endsWith(ext)) {
              const fileType = ext.substring(1); // Remove the dot
              const eventKey = buildEventKey('download', fileType);
              batch.increment(eventKey);
              break;
            }
          }
        } catch {
          // Invalid URL
        }
      }
    },
    true
  );
}

// Error tracking is now handled by errorTracking.ts module (setupEnhancedErrorTracking)

function setupSearchTracking() {
  // Track search form submissions
  document.addEventListener(
    'submit',
    (e) => {
      const form = e.target as HTMLFormElement;
      if (!form) return;

      // Check if form has search input
      const searchInput = form.querySelector('input[type="search"], input[name*="search" i], input[id*="search" i], input[class*="search" i]') as HTMLInputElement;
      if (searchInput && searchInput.value) {
        // Hash or truncate search term for privacy
        const searchTerm = searchInput.value.trim();
        if (searchTerm.length > 0) {
          // Simple hash (for privacy, not security)
          const hash = searchTerm.split('').reduce((acc, char) => {
            const hash = ((acc << 5) - acc) + char.charCodeAt(0);
            return hash & hash;
          }, 0);
          const hashedTerm = Math.abs(hash).toString(36).substring(0, 8);
          const eventKey = buildEventKey('search', hashedTerm);
          batch.increment(eventKey);
        }
      }

      // Also check URL search params
      const urlParams = new URLSearchParams(window.location.search);
      const searchParams = ['q', 'query', 'search', 's', 'keyword'];
      for (const param of searchParams) {
        const value = urlParams.get(param);
        if (value) {
          const hash = value.split('').reduce((acc, char) => {
            const hash = ((acc << 5) - acc) + char.charCodeAt(0);
            return hash & hash;
          }, 0);
          const hashedTerm = Math.abs(hash).toString(36).substring(0, 8);
          const eventKey = buildEventKey('search', hashedTerm);
          batch.increment(eventKey);
          break;
        }
      }
    },
    true
  );
}

function setupPerformanceTracking() {
  if (!window.performance || !window.performance.getEntriesByType) {
    return;
  }

  // Track Core Web Vitals and performance metrics
  const trackPerformanceMetric = (name: string, value: number) => {
    const eventKey = buildEventKey('perf', name);
    batch.increment(eventKey);
  };

  // LCP (Largest Contentful Paint)
  if ('PerformanceObserver' in window) {
    try {
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1] as any;
        if (lastEntry && lastEntry.renderTime) {
          trackPerformanceMetric('lcp', Math.round(lastEntry.renderTime));
        }
      });
      lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
    } catch (e) {
      // LCP not supported
    }

    // FID (First Input Delay) / INP (Interaction to Next Paint)
    try {
      const fidObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry: any) => {
          if (entry.processingStart && entry.startTime) {
            const delay = entry.processingStart - entry.startTime;
            trackPerformanceMetric('fid', Math.round(delay));
          }
        });
      });
      fidObserver.observe({ entryTypes: ['first-input'] });
    } catch (e) {
      // FID not supported
    }

    // CLS (Cumulative Layout Shift)
    try {
      let clsValue = 0;
      const clsObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry: any) => {
          if (!entry.hadRecentInput && entry.value) {
            clsValue += entry.value;
          }
        });
        // Track CLS periodically (on page unload or after 5s)
        if (clsValue > 0) {
          trackPerformanceMetric('cls', Math.round(clsValue * 1000) / 1000);
        }
      });
      clsObserver.observe({ entryTypes: ['layout-shift'] });
    } catch (e) {
      // CLS not supported
    }
  }

  // TTFB and FCP from navigation timing
  window.addEventListener('load', () => {
    setTimeout(() => {
      const perfData = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      if (perfData) {
        // TTFB (Time to First Byte)
        const ttfb = perfData.responseStart - perfData.requestStart;
        if (ttfb > 0) {
          trackPerformanceMetric('ttfb', Math.round(ttfb));
        }

        // FCP (First Contentful Paint)
        const paintEntries = performance.getEntriesByType('paint');
        const fcpEntry = paintEntries.find((entry: any) => entry.name === 'first-contentful-paint');
        if (fcpEntry) {
          trackPerformanceMetric('fcp', Math.round(fcpEntry.startTime));
        }

        // Page load time
        const loadTime = perfData.loadEventEnd - perfData.fetchStart;
        if (loadTime > 0) {
          trackPerformanceMetric('load', Math.round(loadTime));
        }
      }
    }, 0);
  });
}

function setupCustomEventTrackers() {
  // Get siteId from script tag or window
  let siteId: string | null = null;
  
  // Try to get siteId from script tag data attribute
  const script = document.currentScript as HTMLScriptElement | null;
  if (script) {
    siteId = script.getAttribute('data-site-id');
  }
  
  // Fallback: try to get from window (set during init)
  if (!siteId && (window as any).__aa_siteId) {
    siteId = (window as any).__aa_siteId;
  }
  
  if (!siteId) {
    // Can't load trackers without siteId
    return;
  }
  
  // Load trackers asynchronously
  loadCustomEventTrackers(siteId);
  
  // Add click listener for custom trackers
  document.addEventListener(
    'click',
    (e) => {
      if (customTrackers.length === 0) return;
      
      const target = e.target as HTMLElement;
      if (!target) return;
      
      // Check if clicked element matches any tracker's selector
      for (const tracker of customTrackers) {
        try {
          // Check if target or any ancestor matches the selector
          let element: HTMLElement | null = target;
          while (element) {
            if (element.matches && element.matches(tracker.cssSelector)) {
              // Match found! Send event
              const value = tracker.value ? parseFloat(tracker.value) : undefined;
              batch.sendEvent(tracker.eventName, value !== undefined ? { value } : undefined);
              return; // Only track first match
            }
            element = element.parentElement;
          }
        } catch (err) {
          // Invalid selector, skip
          // Invalid selector
        }
      }
    },
    true // capture phase
  );
}

function loadCustomEventTrackers(siteId: string) {
  // Try to determine web API URL
  // The collector endpoint is stored in batch config, but we need the web API URL
  // Try to get from window (can be set during script initialization)
  let apiBaseUrl: string | null = null;
  
  if ((window as any).__aa_webApiUrl) {
    apiBaseUrl = (window as any).__aa_webApiUrl;
  } else {
    // Try to infer from collector endpoint
    // If collector is at http://collector.example.com, web might be at http://example.com
    // Or they might be on different ports: collector:3001, web:3000
    // For now, we'll try to use the script's origin (where it was loaded from)
    // The script is loaded from the collector, so we can't use that
    // Instead, we'll try to use the current page origin as a fallback
    // This works if the user's site and analytics app are on the same domain
    // Otherwise, the webApiUrl should be set explicitly
    apiBaseUrl = window.location.origin;
  }
  
  if (!apiBaseUrl) {
    console.debug('Cannot determine web API URL for custom event trackers');
    return;
  }
  
  // Ensure apiBaseUrl includes /app basePath if it's the noname.fyi domain
  let finalApiUrl = apiBaseUrl;
  if (apiBaseUrl === 'https://noname.fyi' || apiBaseUrl === 'http://noname.fyi') {
    finalApiUrl = `${apiBaseUrl}/app`;
  }
  
  const apiUrl = `${finalApiUrl}/api/public/trackers/${siteId}`;
  
  fetch(apiUrl, {
    credentials: 'omit', // Explicitly omit credentials to avoid CORS issues
  })
    .then((res) => {
      if (!res.ok) return null;
      return res.json();
    })
    .then((data) => {
      if (data && Array.isArray(data.trackers)) {
        customTrackers = data.trackers;
        trackersLoaded = true;
      }
    })
    .catch((err) => {
      // Silent failure - trackers are optional
      console.debug('Failed to load custom event trackers:', err);
    });
}

