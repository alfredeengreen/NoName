export interface DeviceInfo {
  os?: string;
  dc?: 'mobile' | 'tablet' | 'desktop';
  sw?: number;
  sh?: number;
  dpr?: number;
  browser?: string;
  browserVersion?: string;
  browserEngine?: string;
  language?: string;
  connectionType?: string;
}

export function getDeviceInfo(): DeviceInfo {
  const screenWidth = window.screen?.width || 0;
  const screenHeight = window.screen?.height || 0;
  const dpr = window.devicePixelRatio || 1;

  // Detect OS (minimal)
  let os: string | undefined;
  const platform = (navigator as any).userAgentData?.platform || navigator.platform || '';
  const platformLower = platform.toLowerCase();

  if (platformLower.includes('win')) {
    os = 'Windows';
  } else if (platformLower.includes('mac')) {
    os = 'macOS';
  } else if (platformLower.includes('linux')) {
    os = 'Linux';
  } else if (platformLower.includes('iphone') || platformLower.includes('ipad')) {
    os = 'iOS';
  } else if (platformLower.includes('android')) {
    os = 'Android';
  }

  // Detect device category
  let dc: 'mobile' | 'tablet' | 'desktop' | undefined;
  if (screenWidth < 768) {
    dc = 'mobile';
  } else if (screenWidth < 1024) {
    dc = 'tablet';
  } else {
    dc = 'desktop';
  }

  // Detect browser
  const ua = navigator.userAgent;
  let browser: string | undefined;
  let browserVersion: string | undefined;
  let browserEngine: string | undefined;

  // Use User-Agent Client Hints API if available (more privacy-friendly)
  if ((navigator as any).userAgentData) {
    const uaData = (navigator as any).userAgentData;
    browser = uaData.brands?.[0]?.brand || undefined;
    browserVersion = uaData.brands?.[0]?.version || undefined;
  } else {
    // Fallback to user agent parsing
    if (ua.includes('Chrome') && !ua.includes('Edg') && !ua.includes('OPR')) {
      browser = 'Chrome';
      const match = ua.match(/Chrome\/(\d+)/);
      if (match) {
        const majorVersion = parseInt(match[1], 10);
        browserVersion = `${majorVersion}+`; // Aggregate version for privacy
      }
      browserEngine = 'Blink';
    } else if (ua.includes('Firefox')) {
      browser = 'Firefox';
      const match = ua.match(/Firefox\/(\d+)/);
      if (match) {
        const majorVersion = parseInt(match[1], 10);
        browserVersion = `${majorVersion}+`;
      }
      browserEngine = 'Gecko';
    } else if (ua.includes('Safari') && !ua.includes('Chrome')) {
      browser = 'Safari';
      const match = ua.match(/Version\/(\d+)/);
      if (match) {
        const majorVersion = parseInt(match[1], 10);
        browserVersion = `${majorVersion}+`;
      }
      browserEngine = 'WebKit';
    } else if (ua.includes('Edg')) {
      browser = 'Edge';
      const match = ua.match(/Edg\/(\d+)/);
      if (match) {
        const majorVersion = parseInt(match[1], 10);
        browserVersion = `${majorVersion}+`;
      }
      browserEngine = 'Blink';
    } else if (ua.includes('OPR')) {
      browser = 'Opera';
      const match = ua.match(/OPR\/(\d+)/);
      if (match) {
        const majorVersion = parseInt(match[1], 10);
        browserVersion = `${majorVersion}+`;
      }
      browserEngine = 'Blink';
    }
  }

  // Language/locale
  const language = navigator.language || navigator.languages?.[0] || undefined;

  // Connection type (Network Information API)
  let connectionType: string | undefined;
  if ((navigator as any).connection) {
    const conn = (navigator as any).connection;
    connectionType = conn.effectiveType || conn.type || undefined;
  } else if ((navigator as any).mozConnection) {
    const conn = (navigator as any).mozConnection;
    connectionType = conn.effectiveType || conn.type || undefined;
  } else if ((navigator as any).webkitConnection) {
    const conn = (navigator as any).webkitConnection;
    connectionType = conn.effectiveType || conn.type || undefined;
  }

  return {
    os,
    dc,
    sw: screenWidth > 0 ? screenWidth : undefined,
    sh: screenHeight > 0 ? screenHeight : undefined,
    dpr: dpr > 0 ? dpr : undefined,
    browser,
    browserVersion,
    browserEngine,
    language,
    connectionType,
  };
}

