'use client';

import { useEffect, useState } from 'react';
import { getApiUrl } from '@/lib/api-client';

export default function HomePage() {
  const [redirecting, setRedirecting] = useState(true);

  useEffect(() => {
    // Use window.location for direct redirects to avoid Next.js routing conflicts
    const checkAndRedirect = async () => {
      try {
        // Check if user is logged in
        const meResponse = await fetch(getApiUrl('/api/auth/me'), {
          credentials: 'include',
        });
        if (meResponse.ok) {
          // User is logged in, redirect to sites
          const currentPath = window.location.pathname;
          if (!currentPath.includes('/sites')) {
            window.location.href = '/app/sites';
          }
          return;
        }

        // Check if onboarding is needed
        const onboardingResponse = await fetch(getApiUrl('/api/onboarding/status'), {
          credentials: 'include',
        });
        if (onboardingResponse.ok) {
          const onboardingData = await onboardingResponse.json();
          if (onboardingData.needsOnboarding) {
            const currentPath = window.location.pathname;
            if (!currentPath.includes('/onboarding')) {
              window.location.href = '/app/onboarding';
            }
            return;
          }
        }

        // Not logged in, go to login
        const currentPath = window.location.pathname;
        if (!currentPath.includes('/login') && !currentPath.includes('/register')) {
          window.location.href = '/app/login';
        }
      } catch (error) {
        // On error, go to login
        console.error('Error checking auth status:', error);
        const currentPath = window.location.pathname;
        if (!currentPath.includes('/login') && !currentPath.includes('/register')) {
          window.location.href = '/app/login';
        }
      }
    };

    // Small delay to ensure component is mounted
    const timer = setTimeout(() => {
      checkAndRedirect();
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  // Show loading state while checking
  return (
    <div className="flex h-screen items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
}

// Note: To access onboarding pages after setup, set localStorage.debug_onboarding = 'true' in browser console

