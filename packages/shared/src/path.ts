/**
 * Path normalization utilities
 */

export type PathRule =
  | { type: 'strip_trailing_slash'; enabled: boolean }
  | { type: 'lowercase'; enabled: boolean }
  | { type: 'rewrite'; pattern: string; replacement: string; enabled: boolean }
  | { type: 'allow_query_params'; params: string[]; enabled: boolean };

export interface NormalizedPathResult {
  normalizedPath: string;
  rawPath: string;
  normalizedParams?: Record<string, string>;
}

/**
 * Strip query string and hash from URL or path
 */
export function stripQueryAndHash(urlOrPath: string): string {
  try {
    // If it looks like a full URL, parse it
    if (urlOrPath.includes('://')) {
      const url = new URL(urlOrPath);
      return url.pathname;
    }
    
    // Otherwise, just remove query and hash
    return urlOrPath.split('?')[0].split('#')[0];
  } catch {
    // If URL parsing fails, just remove ? and #
    return urlOrPath.split('?')[0].split('#')[0];
  }
}

/**
 * Normalize path according to rules and site config
 * Returns both normalized path and raw path, plus any allowlisted query params
 */
export function normalizePath(
  rawPath: string,
  rules: PathRule[],
  allowedQueryParams?: string[]
): NormalizedPathResult {
  const rawPathValue = rawPath;
  let pathname = rawPath;
  let queryString = '';
  const normalizedParams: Record<string, string> = {};

  // Extract pathname and query string
  try {
    if (rawPath.includes('://')) {
      const url = new URL(rawPath);
      pathname = url.pathname;
      queryString = url.search;
    } else {
      const [path, query] = rawPath.split('?');
      pathname = path.split('#')[0];
      queryString = query ? `?${query.split('#')[0]}` : '';
    }
  } catch {
    // If parsing fails, just split on ?
    const [path, query] = rawPath.split('?');
    pathname = path.split('#')[0];
    queryString = query ? `?${query.split('#')[0]}` : '';
  }

  // Extract allowlisted query params
  if (allowedQueryParams && allowedQueryParams.length > 0 && queryString) {
    try {
      const urlParams = new URLSearchParams(queryString);
      for (const param of allowedQueryParams) {
        const value = urlParams.get(param);
        if (value !== null) {
          normalizedParams[param] = value;
        }
      }
    } catch {
      // Invalid query string, ignore
    }
  }

  // Start with pathname (without query params)
  let normalized = pathname;

  // Apply rules in order
  for (const rule of rules) {
    if (!rule.enabled) {
      continue;
    }

    switch (rule.type) {
      case 'strip_trailing_slash':
        if (normalized !== '/' && normalized.endsWith('/')) {
          normalized = normalized.slice(0, -1);
        }
        break;

      case 'lowercase':
        normalized = normalized.toLowerCase();
        break;

      case 'rewrite': {
        try {
          const regex = new RegExp(rule.pattern);
          normalized = normalized.replace(regex, rule.replacement);
        } catch {
          // Invalid regex, skip
        }
        break;
      }

      case 'allow_query_params': {
        // This is handled above by extracting params before normalization
        break;
      }
    }
  }

  return {
    normalizedPath: normalized,
    rawPath: rawPathValue,
    normalizedParams: Object.keys(normalizedParams).length > 0 ? normalizedParams : undefined,
  };
}

/**
 * Legacy normalizePath function for backward compatibility
 * Returns just the normalized path string
 */
export function normalizePathLegacy(path: string, rules: PathRule[]): string {
  const result = normalizePath(path, rules);
  return result.normalizedPath;
}

/**
 * Get default path rules
 */
export function getDefaultPathRules(): PathRule[] {
  return [
    { type: 'strip_trailing_slash', enabled: true },
    { type: 'lowercase', enabled: false },
  ];
}


