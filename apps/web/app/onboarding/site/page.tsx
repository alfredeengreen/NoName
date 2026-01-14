'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, ArrowRight } from 'lucide-react';
import confetti from 'canvas-confetti';
import { DataCollectionAnimation } from '@/components/data-collection-animation';
import { getApiUrl } from '@/lib/api-client';

export default function OnboardingSitePage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [confettiTriggered, setConfettiTriggered] = useState(false);

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

  const triggerConfetti = () => {
    if (confettiTriggered) return;
    setConfettiTriggered(true);

    const duration = 3000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

    function randomInRange(min: number, max: number) {
      return Math.random() * (max - min) + min;
    }

    const interval: NodeJS.Timeout = setInterval(function() {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);
      
      // Launch from multiple points
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
      });
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
      });
    }, 250);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Site name is required');
      return;
    }

    if (trimmedName.length > 255) {
      setError('Site name must be 255 characters or less');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(getApiUrl('/api/sites/new'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmedName }),
      });

      const data = await res.json();

      if (res.ok) {
        if (data.siteId) {
          // Trigger confetti celebration
          triggerConfetti();
          
          // Show success message, then navigate to implementation screen
          setTimeout(() => {
            router.push(`/onboarding/implement?siteId=${data.siteId}`);
          }, 2500);
        } else {
          setError('Site created but no site ID returned. Please refresh the page.');
          setLoading(false);
        }
      } else {
        const errorMsg = data.error || 'Failed to create site. Please try again.';
        setError(errorMsg);
        setLoading(false);
      }
    } catch (err: any) {
      console.error('Error creating site:', err);
      setError(err.message || 'Network error. Please check your connection and try again.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left side - Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md space-y-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-2 w-2 rounded-full bg-blue-600"></div>
              <span className="text-sm text-muted-foreground">Step 3 of 4</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Add Your First Website</h1>
            <p className="text-muted-foreground">
              Create your first site to start tracking analytics
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive" className="animate-in slide-in-from-top-2">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {confettiTriggered && (
              <Alert className="animate-in slide-in-from-top-2 bg-green-50 border-green-200">
                <AlertDescription className="text-green-800 font-medium">
                  Website created! 🎉
                </AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="site-name">Site Name</Label>
              <Input
                id="site-name"
                type="text"
                placeholder="My Website"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={255}
                disabled={loading || confettiTriggered}
              />
              <p className="text-xs text-muted-foreground">
                {name.length}/255 characters
              </p>
            </div>
            <Button 
              type="submit" 
              className="w-full" 
              disabled={loading || confettiTriggered || !name.trim()}
            >
              {loading ? 'Creating...' : confettiTriggered ? 'Redirecting...' : 'Create Website'}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </form>
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

