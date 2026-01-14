'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import { CheckCircle2, XCircle, Copy, Check, Loader2 } from 'lucide-react';
import { DataCollectionAnimation } from '@/components/data-collection-animation';

interface Site {
  name: string;
  publicSiteId: string;
  publicWriteKey: string;
}

function OnboardingImplementContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const siteId = searchParams.get('siteId');
  
  const [site, setSite] = useState<Site | null>(null);
  const [copied, setCopied] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<'success' | 'error' | null>(null);
  const [error, setError] = useState('');
  const [collectorUrl, setCollectorUrl] = useState('https://noname.fyi/collector');

  useEffect(() => {
    // Use environment variable if available, otherwise use production domain
    if (typeof window !== 'undefined') {
      const envUrl = process.env.NEXT_PUBLIC_COLLECTOR_URL;
      setCollectorUrl(envUrl || 'https://noname.fyi/collector');
    }
  }, []);

  useEffect(() => {
    if (!siteId) {
      setError('Site ID is required');
      return;
    }

    fetch(`/app/api/sites/${siteId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.site) {
          setSite(data.site);
        } else {
          setError('Failed to load site information');
        }
      })
      .catch((err) => {
        console.error('Error fetching site:', err);
        setError('Failed to load site information');
      });
  }, [siteId]);

  if (!siteId) {
    return (
      <div className="min-h-screen flex">
        <div className="flex-1 flex items-center justify-center p-8 bg-background">
          <div className="w-full max-w-md">
            <Alert variant="destructive">
              <AlertDescription>Site ID is required</AlertDescription>
            </Alert>
          </div>
        </div>
        <div className="hidden lg:block lg:w-1/2 relative">
          <DataCollectionAnimation />
        </div>
      </div>
    );
  }

  if (error && !site) {
    return (
      <div className="min-h-screen flex">
        <div className="flex-1 flex items-center justify-center p-8 bg-background">
          <div className="w-full max-w-md">
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </div>
        </div>
        <div className="hidden lg:block lg:w-1/2 relative">
          <DataCollectionAnimation />
        </div>
      </div>
    );
  }

  if (!site) {
    return (
      <div className="min-h-screen flex">
        <div className="flex-1 flex items-center justify-center p-8 bg-background">
          <div className="w-full max-w-md text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
            <p className="mt-4 text-muted-foreground">Loading site information...</p>
          </div>
        </div>
        <div className="hidden lg:block lg:w-1/2 relative">
          <DataCollectionAnimation />
        </div>
      </div>
    );
  }

  const snippet = `<script>
  (function(w,d,s,u){
    w.aa=w.aa||function(){(aa.q=aa.q||[]).push(arguments)};
    var js=d.createElement(s);js.async=1;js.src=u;
    var f=d.getElementsByTagName(s)[0];f.parentNode.insertBefore(js,f);
  })(window,document,'script','${collectorUrl}/analytics.js');
  aa('init',{
    siteId:'${site.publicSiteId}',
    key:'${site.publicWriteKey}',
    endpoint:'${collectorUrl}'
  });
</script>`;

  const copyToClipboard = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleValidate = async () => {
    setValidating(true);
    setValidationResult(null);
    setError('');

    try {
      const res = await fetch(`/app/api/sites/${siteId}/verify`);
      const data = await res.json();

      if (res.ok && data.verified) {
        setValidationResult('success');
        setTimeout(() => {
          router.push(`/sites/${siteId}/overview`);
        }, 2000);
      } else {
        setValidationResult('error');
        setError('Script not detected. Make sure you\'ve added the script to your website and it\'s loaded.');
      }
    } catch (err) {
      console.error('Error validating:', err);
      setValidationResult('error');
      setError('Failed to validate. Please try again.');
    } finally {
      setValidating(false);
    }
  };

  const handleDoLater = () => {
    router.push(`/sites/${siteId}/overview`);
  };

  return (
    <div className="min-h-screen flex">
      {/* Left side - Implementation instructions */}
      <div className="flex-1 flex items-center justify-center p-8 bg-background overflow-y-auto">
        <div className="w-full max-w-3xl space-y-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-2 w-2 rounded-full bg-blue-600"></div>
              <span className="text-sm text-muted-foreground">Step 4 of 4</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Add the Tracking Script to Your Website</h1>
            <p className="text-muted-foreground">
              Copy and paste this code into your website to start tracking analytics
            </p>
          </div>

          <div className="space-y-6">
            <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Installation Snippet</Label>
              <Button
                variant="outline"
                size="sm"
                onClick={copyToClipboard}
                className="gap-2"
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    Copy
                  </>
                )}
              </Button>
            </div>
            <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-sm overflow-x-auto relative">
              <pre className="whitespace-pre-wrap">{snippet}</pre>
            </div>
          </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
            <h3 className="font-semibold text-blue-900">Placement Instructions</h3>
            <ol className="list-decimal list-inside space-y-1 text-sm text-blue-800">
              <li>Copy the script above</li>
              <li>Paste it into the <code className="bg-blue-100 px-1 rounded">&lt;head&gt;</code> section of your website</li>
              <li>Place it before the closing <code className="bg-blue-100 px-1 rounded">&lt;/head&gt;</code> tag</li>
              <li>Save and publish your website</li>
            </ol>
            <div className="mt-3 p-3 bg-white rounded border border-blue-200">
              <p className="text-xs font-mono text-gray-700">
                <span className="text-gray-500">&lt;head&gt;</span>
                <br />
                <span className="text-blue-600 ml-4">... your script here ...</span>
                <br />
                <span className="text-gray-500">&lt;/head&gt;</span>
              </p>
            </div>
            </div>

          {validationResult === 'success' && (
            <Alert className="bg-green-50 border-green-200 animate-in slide-in-from-top-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                Script detected successfully! Redirecting to dashboard...
              </AlertDescription>
            </Alert>
          )}

          {validationResult === 'error' && (
            <Alert variant="destructive" className="animate-in slide-in-from-top-2">
              <XCircle className="h-4 w-4" />
              <AlertDescription>
                {error || 'Script not detected. Please make sure you\'ve added the script and published your website.'}
              </AlertDescription>
            </Alert>
          )}

          <div className="flex gap-4 pt-4">
            <Button
              onClick={handleValidate}
              disabled={validating || validationResult === 'success'}
              className="flex-1"
            >
              {validating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Validating...
                </>
              ) : validationResult === 'success' ? (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Verified!
                </>
              ) : (
                'Validate Implementation'
              )}
            </Button>
            <Button
              variant="outline"
              onClick={handleDoLater}
              disabled={validating || validationResult === 'success'}
              className="flex-1"
            >
              Do Later
            </Button>
          </div>
          </div>
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

export default function OnboardingImplementPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    }>
      <OnboardingImplementContent />
    </Suspense>
  );
}

