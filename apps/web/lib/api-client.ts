/**
 * API client utility for consistent API calls with basePath support
 * 
 * Next.js basePath automatically prefixes relative URLs, but this utility
 * provides explicit control and ensures consistency across the application.
 */

/**
 * Get the base path for API calls
 * In the browser, this will be the basePath from Next.js config
 * On the server, this should be empty or the basePath
 */
export function getApiBasePath(): string {
  if (typeof window !== 'undefined') {
    // Client-side: Next.js automatically handles basePath for relative URLs
    // But we can also use window.location to get the current origin + basePath
    return '';
  }
  // Server-side: basePath is configured in next.config.js
  return process.env.NEXT_PUBLIC_BASE_PATH || '/app';
}

/**
 * Create an API URL with proper basePath handling
 * @param path - API path (e.g., '/api/sites' or 'api/sites')
 * @returns Full API URL
 */
export function apiUrl(path: string): string {
  // Remove leading slash if present to avoid double slashes
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  
  if (typeof window !== 'undefined') {
    // Client-side: use relative path, Next.js will handle basePath
    return `/${cleanPath}`;
  }
  
  // Server-side: construct full URL if needed
  const basePath = getApiBasePath();
  return `${basePath}/${cleanPath}`;
}

/**
 * Get API URL (alias for apiUrl for backward compatibility)
 * @param path - API path
 * @returns Full API URL
 */
export function getApiUrl(path: string): string {
  return apiUrl(path);
}

/**
 * Fetch wrapper that ensures proper basePath handling
 * @param path - API path
 * @param options - Fetch options
 * @returns Promise<Response>
 */
export async function apiFetch(
  path: string,
  options?: RequestInit
): Promise<Response> {
  const url = apiUrl(path);
  return fetch(url, options);
}

