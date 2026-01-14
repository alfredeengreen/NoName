'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { DataCollectionAnimation } from '@/components/data-collection-animation';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Clear any invalid session cookies on mount
  useEffect(() => {
    fetch(`${window.location.origin}/app/api/auth/logout`, { method: 'POST' }).catch(() => {
      // Ignore errors - just trying to clear invalid sessions
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Use absolute path to ensure basePath is included
      const res = await fetch(`${window.location.origin}/app/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (res.ok) {
        // Use window.location for absolute path to avoid basePath issues
        window.location.href = '/app/sites';
        return;
      } else {
        const data = await res.json();
        setError(data.error || 'Login failed');
      }
    } catch (err) {
      setError('An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left side - Login form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md space-y-6">
          <div className="space-y-2 text-center">
            <div className="flex justify-center mb-4">
              <Image
                src="/nonameanalyticslogo.png"
                alt="No Name Analytics Logo"
                width={105}
                height={116}
                className="object-contain"
                priority
                unoptimized
              />
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Welcome back</h1>
            <p className="text-muted-foreground">
              Sign in to your account to continue
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link
                  href="#"
                  className="text-sm text-muted-foreground hover:text-primary"
                >
                  Forgot password?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign in'}
            </Button>
          </form>

          {/* Temporarily hidden sign up link */}
          {/* <div className="text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{' '}
            <Link href="/register" className="text-primary hover:underline font-medium">
              Sign up
            </Link>
          </div> */}
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
