import { batch } from './batch';
import { getDeviceInfo } from './device';

interface HeatmapPoint {
  x: number; // normalized 0-1000
  y: number; // normalized 0-1000
  type: 'click' | 'scroll' | 'move';
}

// Heatmap data buffer
const heatmapBuffer: HeatmapPoint[] = [];
const MAX_BUFFER_SIZE = 100;
const FLUSH_INTERVAL_MS = 10000; // 10 seconds

// Normalize coordinates to 0-1000 range
function normalizeCoordinate(value: number, max: number): number {
  return Math.round((value / max) * 1000);
}

// Track click positions
function setupClickTracking() {
  document.addEventListener('click', (e) => {
    const x = normalizeCoordinate(e.clientX, window.innerWidth);
    const y = normalizeCoordinate(e.clientY, window.innerHeight);
    
    heatmapBuffer.push({
      x,
      y,
      type: 'click',
    });
    
    if (heatmapBuffer.length >= MAX_BUFFER_SIZE) {
      flushHeatmap();
    }
  }, true);
}

// Track scroll depth
let maxScrollDepth = 0;
function setupScrollTracking() {
  let lastScrollY = window.scrollY;
  let scrollDirectionChanges = 0;
  
  window.addEventListener('scroll', () => {
    const scrollY = window.scrollY;
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    const scrollPercent = maxScroll > 0 ? (scrollY / maxScroll) * 100 : 0;
    
    // Track scroll depth milestones
    if (scrollPercent > maxScrollDepth) {
      maxScrollDepth = Math.max(maxScrollDepth, scrollPercent);
      
      // Record scroll milestones (25%, 50%, 75%, 90%, 100%)
      const milestones = [25, 50, 75, 90, 100];
      const milestone = milestones.find(m => scrollPercent >= m && maxScrollDepth < m);
      
      if (milestone) {
        const y = normalizeCoordinate(scrollY, document.documentElement.scrollHeight);
        heatmapBuffer.push({
          x: 500, // Center of page
          y,
          type: 'scroll',
        });
      }
    }
    
    // Detect rapid scroll direction changes (frustration signal)
    if ((scrollY > lastScrollY && scrollDirectionChanges < 0) || 
        (scrollY < lastScrollY && scrollDirectionChanges > 0)) {
      scrollDirectionChanges = 0;
    }
    scrollDirectionChanges += scrollY > lastScrollY ? 1 : -1;
    
    lastScrollY = scrollY;
  });
}

// Track mouse movement (throttled, aggregated)
let mouseMoveBuffer: Array<{ x: number; y: number }> = [];
let mouseMoveThrottle: ReturnType<typeof setTimeout> | null = null;

function setupMouseTracking() {
  document.addEventListener('mousemove', (e) => {
    const x = normalizeCoordinate(e.clientX, window.innerWidth);
    const y = normalizeCoordinate(e.clientY, window.innerHeight);
    
    mouseMoveBuffer.push({ x, y });
    
    if (!mouseMoveThrottle) {
      mouseMoveThrottle = setTimeout(() => {
        // Aggregate mouse movements (sample every 10th point)
        const sampled = mouseMoveBuffer.filter((_, idx) => idx % 10 === 0);
        
        sampled.forEach(point => {
          heatmapBuffer.push({
            ...point,
            type: 'move',
          });
        });
        
        mouseMoveBuffer = [];
        mouseMoveThrottle = null;
        
        if (heatmapBuffer.length >= MAX_BUFFER_SIZE) {
          flushHeatmap();
        }
      }, 2000); // Aggregate every 2 seconds
    }
  });
}

// Capture page screenshot using html2canvas
// Note: html2canvas must be loaded separately via CDN or npm
// Add this to your page: <script src="https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js"></script>
async function captureScreenshot(): Promise<string | null> {
  try {
    // Use html2canvas if available
    if (typeof (window as any).html2canvas === 'function') {
      const html2canvas = (window as any).html2canvas;
      const canvas = await html2canvas(document.body, {
        height: window.innerHeight,
        width: window.innerWidth,
        useCORS: true,
        logging: false,
        scale: 0.5, // Reduce size for performance
      });
      return canvas.toDataURL('image/jpeg', 0.7); // Use JPEG with compression
    }
    
    return null;
  } catch (error) {
    // Failed to capture screenshot
    return null;
  }
}

// Screenshot cache per path to avoid capturing too frequently
const screenshotCache = new Map<string, { data: string; timestamp: number }>();
const SCREENSHOT_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Flush heatmap data
async function flushHeatmap() {
  if (heatmapBuffer.length === 0) return;
  
  const path = window.location.pathname + window.location.search;
  const device = getDeviceInfo();
  
  // Try to capture screenshot if we don't have one cached for this path
  let screenshot: string | null = null;
  const cached = screenshotCache.get(path);
  if (cached && Date.now() - cached.timestamp < SCREENSHOT_CACHE_TTL) {
    screenshot = cached.data;
  } else {
    screenshot = await captureScreenshot();
    if (screenshot) {
      screenshotCache.set(path, { data: screenshot, timestamp: Date.now() });
    }
  }
  
  // Group by type and send
  const clicks = heatmapBuffer.filter(p => p.type === 'click');
  const scrolls = heatmapBuffer.filter(p => p.type === 'scroll');
  const moves = heatmapBuffer.filter(p => p.type === 'move');
  
  if (clicks.length > 0) {
    batch.sendEvent('heatmap', {
      type: 'click',
      path,
      points: JSON.stringify(clicks),
      deviceCategory: device.dc || 'unknown',
      screenshot: screenshot || undefined,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
    });
  }
  
  if (scrolls.length > 0) {
    batch.sendEvent('heatmap', {
      type: 'scroll',
      path,
      points: JSON.stringify(scrolls),
      deviceCategory: device.dc || 'unknown',
      screenshot: screenshot || undefined,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
    });
  }
  
  if (moves.length > 0) {
    batch.sendEvent('heatmap', {
      type: 'move',
      path,
      points: JSON.stringify(moves),
      deviceCategory: device.dc || 'unknown',
      screenshot: screenshot || undefined,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
    });
  }
  
  heatmapBuffer.length = 0;
}

// Initialize heatmap tracking
export function setupHeatmapTracking() {
  setupClickTracking();
  setupScrollTracking();
  setupMouseTracking();
  
  // Periodic flush
  setInterval(flushHeatmap, FLUSH_INTERVAL_MS);
  
  // Flush on page unload
  window.addEventListener('beforeunload', flushHeatmap);
  window.addEventListener('pagehide', flushHeatmap);
}


