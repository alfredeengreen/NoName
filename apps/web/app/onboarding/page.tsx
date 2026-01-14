'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import { DataCollectionAnimation } from '@/components/data-collection-animation';
import { getApiUrl } from '@/lib/api-client';

export default function OnboardingWelcomePage() {
  const router = useRouter();

  useEffect(() => {
    // Debug mode: allow access if localStorage flag is set
    if (typeof window !== 'undefined') {
      const debugOnboarding = localStorage.getItem('debug_onboarding') === 'true';
      if (debugOnboarding) {
        return; // Allow access in debug mode
      }
    }

    // Check if onboarding is already complete
    fetch(getApiUrl('/api/onboarding/status'))
      .then((res) => res.json())
      .then((data) => {
        if (!data.needsOnboarding) {
          router.push('/login');
        }
      })
      .catch(() => {
        // On error, allow access
      });
  }, [router]);

  return (
    <div className="min-h-screen flex">
      {/* Left side - Welcome content */}
      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md space-y-6">
          <div className="space-y-2 text-center">
            <div className="flex justify-center mb-4">
              <Image
                src="/nonameanalyticslogo.png"
                alt="No Name Analytics Logo"
                width={140}
                height={154}
                className="object-contain"
                priority
              />
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Welcome to No Name Analytics</h1>
            <p className="text-muted-foreground">
              A privacy-first analytics platform that gives you complete control over your data.
              Track user behavior, understand your audience, and make data-driven decisions—all while respecting user privacy.
            </p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-900">
            <p className="font-medium mb-1">Getting Started</p>
            <p>The next step is to set up an admin user. More users can be added later from your dashboard.</p>
          </div>

          <Button 
            onClick={() => router.push('/onboarding/user')}
            className="w-full h-12 text-lg group"
            size="lg"
          >
            Continue Setup
            <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
          </Button>
        </div>
      </div>

      {/* Right side - Animation */}
      <div className="hidden lg:block lg:w-1/2 relative">
        <DataCollectionAnimation />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center space-y-4 px-8">
            <h2 className="text-3xl font-bold text-white">Data Collection Across Your Ecosystem</h2>
            <p className="text-blue-200 text-lg">
              Track, analyze, and understand your data in real-time
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

