/**
 * Helper function to fetch API data with proper error handling
 */
export async function fetchApiData<T>(
  url: string,
  options?: RequestInit
): Promise<{ data: T | null; error: string | null }> {
  try {
    const res = await fetch(url, options);
    
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({ error: 'Unknown error' }));
      return {
        data: null,
        error: errorData.error || `HTTP ${res.status}: ${res.statusText}`,
      };
    }

    const data = await res.json();
    return { data, error: null };
  } catch (error) {
    console.error('API fetch error:', error);
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}


