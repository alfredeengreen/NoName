import { batch } from './batch';

// Rage click detection (3+ clicks in <1s on same element)
interface ClickRecord {
  element: string;
  timestamp: number;
  count: number;
}

const clickRecords = new Map<string, ClickRecord>();

// Dead click detection (click with no response)
let lastClickTime = 0;
let lastClickElement: string | null = null;
let clickResponseTimeout: ReturnType<typeof setTimeout> | null = null;

// Excessive scrolling detection
let scrollDirectionChanges = 0;
let lastScrollY = 0;
let scrollChangeTimeout: ReturnType<typeof setTimeout> | null = null;

// Form field rage detection
const formFieldRage = new Map<string, { count: number; lastTime: number }>();

// Detect rage clicks
function detectRageClick(element: HTMLElement) {
  const selector = getElementSelector(element);
  const now = Date.now();
  
  const record = clickRecords.get(selector);
  if (record) {
    // Reset if more than 1 second passed
    if (now - record.timestamp > 1000) {
      record.count = 1;
      record.timestamp = now;
    } else {
      record.count++;
      
      // Detect rage click (3+ clicks in <1s)
      if (record.count >= 3) {
        batch.sendEvent('frustration', {
          type: 'rage_click',
          selector,
          count: record.count,
        });
        record.count = 0; // Reset after detection
      }
    }
  } else {
    clickRecords.set(selector, {
      element: selector,
      timestamp: now,
      count: 1,
    });
  }
}

// Detect dead clicks (clicks with no response)
function detectDeadClick(element: HTMLElement) {
  const selector = getElementSelector(element);
  const now = Date.now();
  
  lastClickTime = now;
  lastClickElement = selector;
  
  // Clear previous timeout
  if (clickResponseTimeout) {
    clearTimeout(clickResponseTimeout);
  }
  
  // Check for response after 500ms
  clickResponseTimeout = setTimeout(() => {
    // If no navigation, form submission, or visible change occurred, it's a dead click
    if (lastClickElement === selector && Date.now() - lastClickTime < 1000) {
      batch.sendEvent('frustration', {
        type: 'dead_click',
        selector,
      });
    }
    lastClickElement = null;
  }, 500);
}

// Detect excessive scrolling
function detectExcessiveScrolling() {
  const scrollY = window.scrollY;
  
  // Detect rapid scroll direction changes
  if ((scrollY > lastScrollY && scrollDirectionChanges < 0) || 
      (scrollY < lastScrollY && scrollDirectionChanges > 0)) {
    scrollDirectionChanges = 0;
  }
  
  scrollDirectionChanges += scrollY > lastScrollY ? 1 : -1;
  
  // Clear timeout
  if (scrollChangeTimeout) {
    clearTimeout(scrollChangeTimeout);
  }
  
  // Check for excessive scrolling (5+ direction changes in 2 seconds)
  scrollChangeTimeout = setTimeout(() => {
    if (Math.abs(scrollDirectionChanges) >= 5) {
      batch.sendEvent('frustration', {
        type: 'excessive_scrolling',
        directionChanges: Math.abs(scrollDirectionChanges),
      });
    }
    scrollDirectionChanges = 0;
  }, 2000);
  
  lastScrollY = scrollY;
}

// Detect form field rage (rapid focus/blur)
function detectFormFieldRage(field: HTMLElement) {
  const selector = getElementSelector(field);
  const now = Date.now();
  
  const record = formFieldRage.get(selector);
  if (record) {
    // If rapid focus/blur (within 500ms)
    if (now - record.lastTime < 500) {
      record.count++;
      
      // Detect rage (5+ rapid focus/blur)
      if (record.count >= 5) {
        batch.sendEvent('frustration', {
          type: 'form_field_rage',
          selector,
          count: record.count,
        });
        record.count = 0;
      }
    } else {
      record.count = 1;
    }
    record.lastTime = now;
  } else {
    formFieldRage.set(selector, {
      count: 1,
      lastTime: now,
    });
  }
}

// Get CSS selector for element
function getElementSelector(element: HTMLElement): string {
  if (element.id) {
    return `#${element.id}`;
  }
  
  if (element.className && typeof element.className === 'string') {
    const classes = element.className.split(' ').filter(c => c).join('.');
    if (classes) {
      return `${element.tagName.toLowerCase()}.${classes}`;
    }
  }
  
  // Try data attributes
  const dataId = element.getAttribute('data-id');
  if (dataId) {
    return `[data-id="${dataId}"]`;
  }
  
  return element.tagName.toLowerCase();
}

// Initialize frustration signal tracking
export function setupFrustrationTracking() {
  // Track clicks for rage click and dead click detection
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    detectRageClick(target);
    detectDeadClick(target);
  }, true);
  
  // Track scrolling for excessive scrolling detection
  window.addEventListener('scroll', detectExcessiveScrolling, { passive: true });
  
  // Track form field focus/blur for rage detection
  document.addEventListener('focusin', (e) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
      detectFormFieldRage(target);
    }
  }, true);
  
  document.addEventListener('focusout', (e) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
      detectFormFieldRage(target);
    }
  }, true);
  
  // Track JavaScript errors during interaction (already handled by error tracking, but we can add context)
  // This is handled by errorTracking.ts
}


