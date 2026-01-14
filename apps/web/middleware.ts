import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const session = request.cookies.get('session');
  const { pathname } = request.nextUrl;

  // Skip middleware for root path and empty path - let the page handle redirects
  // With basePath /app, visiting /app maps to / in the app
  if (pathname === '/' || pathname === '') {
    return NextResponse.next();
  }

  // Onboarding routes - allow public access (pages will check onboarding status)
  if (pathname.startsWith('/onboarding')) {
    return NextResponse.next();
  }

  // Public routes
  if (pathname === '/login' || pathname === '/register') {
    // If user has a session cookie but is on login page, clear it if invalid
    if (session) {
      const response = NextResponse.next();
      // Don't clear here - let the API handle validation
      return response;
    }
    return NextResponse.next();
  }

  // API routes - let them handle their own auth
  if (pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // Protected routes
  if (!session) {
    // Redirect to login - preserve basePath from request.url
    // request.url includes the full URL with basePath (e.g., https://noname.fyi/app/sites/...)
    // request.nextUrl.pathname has basePath stripped (e.g., /sites/...)
    const fullUrl = new URL(request.url);
    // Check if the full URL path includes /app/ (basePath)
    if (fullUrl.pathname.startsWith('/app/')) {
      // Redirect to /app/login
      fullUrl.pathname = '/app/login';
    } else {
      // No basePath, redirect to /login
      fullUrl.pathname = '/login';
    }
    return NextResponse.redirect(fullUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - / (root path - handled by page component)
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (images, etc.)
     * 
     * Pattern: Match paths that have at least one character after /
     * This excludes the root path / but includes all other paths
     */
    '/((?!api|_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).+)',
  ],
};

