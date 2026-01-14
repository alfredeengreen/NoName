'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Save, CheckCircle2 } from 'lucide-react';
import { getApiUrl } from '@/lib/api-client';

interface SiteConfig {
  siteId: string;
  heatmapEnabled: boolean;
  replayEnabled: boolean;
  replayMaskingEnabled: boolean;
  selectorMode: 'strict' | 'lenient';
  maxDistinctEventKeysPerDay: number;
  maxDistinctPathsPerDay: number;
  maxDistinctDimensionValuesPerKeyPerDay: number;
  maxDistinctPerfNamesPerDay: number;
  maxDistinctSelectorsPerDay: number;
  dataRetentionDays: number;
  piiMaskingEnabled: boolean;
  replaySampleRate: number;
  allowedQueryParams?: string[];
}

interface BusinessConfig {
  avgRevenuePerSession?: number;
  avgConversionRate?: number;
}

export default function SettingsPage() {
  const params = useParams();
  const siteId = params.id as string;
  const [config, setConfig] = useState<SiteConfig | null>(null);
  const [businessConfig, setBusinessConfig] = useState<BusinessConfig>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchConfig();
    fetchBusinessConfig();
  }, [siteId]);

  const fetchConfig = async () => {
    try {
      const res = await fetch(getApiUrl(`/api/sites/${siteId}/config`));
      if (!res.ok) throw new Error('Failed to fetch config');
      const data = await res.json();
      setConfig(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchBusinessConfig = async () => {
    try {
      const res = await fetch(getApiUrl(`/api/sites/${siteId}/business-config`));
      if (res.ok) {
        const data = await res.json();
        setBusinessConfig(data);
      }
    } catch (err) {
      // Business config is optional
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    setError(null);

    try {
      // Save site config
      const configRes = await fetch(getApiUrl(`/api/sites/${siteId}/config`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });

      if (!configRes.ok) throw new Error('Failed to save site configuration');

      // Save business config
      const businessRes = await fetch(getApiUrl(`/api/sites/${siteId}/business-config`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(businessConfig),
      });

      if (!businessRes.ok) throw new Error('Failed to save business configuration');

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!config) {
    return (
      <Alert>
        <AlertDescription>Failed to load configuration</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Site Settings</h1>
          <p className="text-muted-foreground mt-1">
            Configure site-specific settings, privacy, and data governance
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : saved ? (
            <>
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Saved
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save Changes
            </>
          )}
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="features" className="space-y-4">
        <TabsList>
          <TabsTrigger value="features">Features</TabsTrigger>
          <TabsTrigger value="privacy">Privacy & Compliance</TabsTrigger>
          <TabsTrigger value="governance">Data Governance</TabsTrigger>
          <TabsTrigger value="business">Business Metrics</TabsTrigger>
        </TabsList>

        <TabsContent value="features" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Feature Flags</CardTitle>
              <CardDescription>Enable or disable specific features for this site</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Heatmaps</Label>
                  <p className="text-sm text-muted-foreground">
                    Track click, scroll, and mouse movement patterns
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={config.heatmapEnabled}
                  onChange={(e) =>
                    setConfig({ ...config, heatmapEnabled: e.target.checked })
                  }
                  className="h-4 w-4 rounded border-gray-300"
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Session Replay</Label>
                  <p className="text-sm text-muted-foreground">
                    Record and replay user sessions for debugging
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={config.replayEnabled}
                  onChange={(e) =>
                    setConfig({ ...config, replayEnabled: e.target.checked })
                  }
                  className="h-4 w-4 rounded border-gray-300"
                />
              </div>

              {config.replayEnabled && (
                <div className="flex items-center justify-between pl-6">
                  <div className="space-y-0.5">
                    <Label>Replay Masking</Label>
                    <p className="text-sm text-muted-foreground">
                      Mask PII in session recordings by default
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={config.replayMaskingEnabled}
                    onChange={(e) =>
                      setConfig({ ...config, replayMaskingEnabled: e.target.checked })
                    }
                    className="h-4 w-4 rounded border-gray-300"
                  />
                </div>
              )}

              {config.replayEnabled && (
                <div className="pl-6 space-y-2">
                  <Label>Replay Sample Rate</Label>
                  <Input
                    type="number"
                    min="0"
                    max="1"
                    step="0.01"
                    value={config.replaySampleRate}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        replaySampleRate: parseFloat(e.target.value) || 0,
                      })
                    }
                  />
                  <p className="text-sm text-muted-foreground">
                    Percentage of sessions to record (0.1 = 10%)
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="privacy" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Privacy Settings</CardTitle>
              <CardDescription>Configure privacy and data protection settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>PII Masking</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically mask personally identifiable information
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={config.piiMaskingEnabled}
                  onChange={(e) =>
                    setConfig({ ...config, piiMaskingEnabled: e.target.checked })
                  }
                  className="h-4 w-4 rounded border-gray-300"
                />
              </div>

              <div className="space-y-2">
                <Label>Data Retention (Days)</Label>
                <Input
                  type="number"
                  min="0"
                  value={config.dataRetentionDays}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      dataRetentionDays: parseInt(e.target.value) || 90,
                    })
                  }
                />
                <p className="text-sm text-muted-foreground">
                  Number of days to retain data (0 = infinite retention)
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="governance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Data Governance</CardTitle>
              <CardDescription>Configure cardinality limits and normalization rules</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Selector Mode</Label>
                <Select
                  value={config.selectorMode}
                  onValueChange={(value: 'strict' | 'lenient') =>
                    setConfig({ ...config, selectorMode: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lenient">Lenient</SelectItem>
                    <SelectItem value="strict">Strict</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  Strict mode keeps only data attributes and IDs, lenient allows more classes
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Max Event Keys/Day</Label>
                  <Input
                    type="number"
                    value={config.maxDistinctEventKeysPerDay}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        maxDistinctEventKeysPerDay: parseInt(e.target.value) || 50000,
                      })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>Max Paths/Day</Label>
                  <Input
                    type="number"
                    value={config.maxDistinctPathsPerDay}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        maxDistinctPathsPerDay: parseInt(e.target.value) || 10000,
                      })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>Max Dimension Values/Day</Label>
                  <Input
                    type="number"
                    value={config.maxDistinctDimensionValuesPerKeyPerDay}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        maxDistinctDimensionValuesPerKeyPerDay: parseInt(e.target.value) || 5000,
                      })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>Max Performance Names/Day</Label>
                  <Input
                    type="number"
                    value={config.maxDistinctPerfNamesPerDay}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        maxDistinctPerfNamesPerDay: parseInt(e.target.value) || 20000,
                      })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>Max Selectors/Day</Label>
                  <Input
                    type="number"
                    value={config.maxDistinctSelectorsPerDay}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        maxDistinctSelectorsPerDay: parseInt(e.target.value) || 50000,
                      })
                    }
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="business" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Business Metrics</CardTitle>
              <CardDescription>
                Configure business metrics for impact calculations
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Average Revenue Per Session</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={businessConfig.avgRevenuePerSession || ''}
                  onChange={(e) =>
                    setBusinessConfig({
                      ...businessConfig,
                      avgRevenuePerSession: parseFloat(e.target.value) || undefined,
                    })
                  }
                />
                <p className="text-sm text-muted-foreground">
                  Used to calculate revenue impact of problems
                </p>
              </div>

              <div className="space-y-2">
                <Label>Average Conversion Rate (%)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={businessConfig.avgConversionRate || ''}
                  onChange={(e) =>
                    setBusinessConfig({
                      ...businessConfig,
                      avgConversionRate: parseFloat(e.target.value) || undefined,
                    })
                  }
                />
                <p className="text-sm text-muted-foreground">
                  Used to estimate lost conversions from problems
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
