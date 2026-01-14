/**
 * Device detection utilities (minimal, no ua-parser-js)
 */

export type DeviceCategory = 'mobile' | 'tablet' | 'desktop';

export interface DeviceInfo {
  os?: string;
  dc?: DeviceCategory;
  sw?: number;
  sh?: number;
  dpr?: number;
}

/**
 * Detect OS from platform (minimal parsing)
 */
export function detectOS(platform?: string, userAgent?: string): string {
  if (!platform && !userAgent) {
    return 'Unknown';
  }

  const platformLower = (platform || '').toLowerCase();
  const uaLower = (userAgent || '').toLowerCase();

  // Check platform first (more reliable)
  if (platformLower.includes('win')) {
    return 'Windows';
  }
  if (platformLower.includes('mac')) {
    return 'macOS';
  }
  if (platformLower.includes('linux')) {
    return 'Linux';
  }
  if (platformLower.includes('iphone') || platformLower.includes('ipad')) {
    return 'iOS';
  }
  if (platformLower.includes('android')) {
    return 'Android';
  }

  // Fallback to user agent
  if (uaLower.includes('windows')) {
    return 'Windows';
  }
  if (uaLower.includes('mac os')) {
    return 'macOS';
  }
  if (uaLower.includes('linux')) {
    return 'Linux';
  }
  if (uaLower.includes('iphone') || uaLower.includes('ipad')) {
    return 'iOS';
  }
  if (uaLower.includes('android')) {
    return 'Android';
  }

  return 'Unknown';
}

/**
 * Detect device category from screen width
 */
export function detectDeviceCategory(screenWidth: number): DeviceCategory {
  if (screenWidth < 768) {
    return 'mobile';
  }
  if (screenWidth < 1024) {
    return 'tablet';
  }
  return 'desktop';
}

/**
 * Get device info from browser APIs (for script)
 * Note: This function is only meant to be used in browser environments
 */
export function getDeviceInfo(): DeviceInfo {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return {};
  }

  const screenWidth = window.screen?.width || 0;
  const screenHeight = window.screen?.height || 0;
  const dpr = window.devicePixelRatio || 1;

  // Try to get platform from navigator
  const platform =
    (navigator as any).userAgentData?.platform || navigator.platform || navigator.userAgent;

  const os = detectOS(platform, navigator.userAgent);
  const dc = detectDeviceCategory(screenWidth);

  return {
    os,
    dc,
    sw: screenWidth > 0 ? screenWidth : undefined,
    sh: screenHeight > 0 ? screenHeight : undefined,
    dpr: dpr > 0 ? dpr : undefined,
  };
}

