'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, CheckCircle2, ArrowRight } from 'lucide-react';
import { DataCollectionAnimation } from '@/components/data-collection-animation';
import { getApiUrl } from '@/lib/api-client';

export default function OnboardingUserPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [orgName, setOrgName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    // Debug mode: allow access if localStorage flag is set
    if (typeof window !== 'undefined') {
      const debugOnboarding = localStorage.getItem('debug_onboarding') === 'true';
      if (debugOnboarding) {
        return; // Allow access in debug mode
      }
    }

    // Check if onboarding is already complete
    fetch(`${window.location.origin}${getApiUrl('/api/onboarding/status')}`)
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);

    try {
      // Use absolute path to ensure basePath is included
      const res = await fetch(`${window.location.origin}${getApiUrl('/api/onboarding/user')}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, orgName }),
      });

      const data = await res.json();

      if (res.ok) {
        setSuccess(true);
        // Show success animation, then navigate
        setTimeout(() => {
          router.push('/onboarding/site');
        }, 1500);
      } else {
        setError(data.error || 'Failed to create user');
        setLoading(false);
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex">
        <div className="flex-1 flex items-center justify-center p-8 bg-background">
          <div className="w-full max-w-md space-y-6 text-center">
            <div className="flex justify-center">
              <CheckCircle2 className="h-16 w-16 text-green-500 animate-in zoom-in duration-300" />
            </div>
            <h2 className="text-2xl font-bold text-green-600">User Created Successfully!</h2>
            <p className="text-muted-foreground">Redirecting to next step...</p>
          </div>
        </div>
        <div className="hidden lg:block lg:w-1/2 relative">
          <DataCollectionAnimation />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* Left side - Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md space-y-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-2 w-2 rounded-full bg-blue-600"></div>
              <span className="text-sm text-muted-foreground">Step 2 of 4</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Create Admin User</h1>
            <p className="text-muted-foreground">
              Set up your admin account and organization
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive" className="animate-in slide-in-from-top-2">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                disabled={loading}
              />
              <p className="text-xs text-muted-foreground">At least 8 characters</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="orgName">Organization Name</Label>
              <Input
                id="orgName"
                type="text"
                placeholder="My Organization"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                required
                maxLength={255}
                disabled={loading}
              />
              <p className="text-xs text-muted-foreground">This can be changed later</p>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Creating...' : 'Continue'}
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

