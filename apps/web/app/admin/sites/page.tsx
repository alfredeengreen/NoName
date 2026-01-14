'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { toast } from '@/lib/toast';
import Link from 'next/link';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/app-sidebar';
import { SiteHeader } from '@/components/site-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getApiUrl } from '@/lib/api-client';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Copy, Check } from 'lucide-react';

interface Site {
  id: string;
  orgId: string;
  orgName: string;
  name: string;
  publicSiteId: string;
  publicWriteKey: string;
  createdAt: string;
}

export default function AdminSitesPage() {
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState({ name: '', orgId: '' });
  const [selectedSite, setSelectedSite] = useState<Site | null>(null);
  const [installScript, setInstallScript] = useState<string>('');
  const [scriptLoading, setScriptLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchSites();
  }, []);

  const fetchSites = async () => {
    try {
      const res = await fetch(getApiUrl('/api/admin/sites'));
      if (!res.ok) throw new Error('Failed to fetch sites');
      const data = await res.json();
      setSites(Array.isArray(data.sites) ? data.sites : []);
    } catch (error: any) {
      toast.error('Failed to fetch sites', { description: error.message });
      setSites([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(getApiUrl('/api/admin/sites'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create site');
      }

      toast.success('Site created');
      setShowCreateForm(false);
      setFormData({ name: '', orgId: '' });
      fetchSites();
    } catch (error: any) {
      toast.error('Failed to create site', { description: error.message });
    }
  };

  const handleDelete = async (siteId: string) => {
    if (!confirm('Are you sure you want to delete this site? This action cannot be undone.')) {
      return;
    }

    try {
      const res = await fetch(`/app/api/admin/sites?id=${siteId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete site');
      }

      toast.success('Site deleted');
      fetchSites();
    } catch (error: any) {
      toast.error('Failed to delete site', { description: error.message });
    }
  };

  const handleOpenInstallModal = async (site: Site) => {
    setSelectedSite(site);
    setScriptLoading(true);
    setInstallScript('');
    setCopied(false);

    try {
      const res = await fetch(`/app/api/admin/install?siteId=${site.id}`);
      if (!res.ok) {
        throw new Error('Failed to fetch install script');
      }
      const data = await res.json();
      setInstallScript(data.script || '');
    } catch (error: any) {
      toast.error('Failed to load install script', { description: error.message });
      setSelectedSite(null);
    } finally {
      setScriptLoading(false);
    }
  };

  const handleCloseModal = () => {
    setSelectedSite(null);
    setInstallScript('');
    setCopied(false);
  };

  const handleCopyScript = async () => {
    if (!installScript) return;
    
    try {
      await navigator.clipboard.writeText(installScript);
      setCopied(true);
      toast.success('Script copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error('Failed to copy script');
    }
  };

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold">Site Management</h1>
            <Button onClick={() => setShowCreateForm(!showCreateForm)}>
              {showCreateForm ? 'Cancel' : 'Create Site'}
            </Button>
          </div>

          {showCreateForm && (
            <Card>
              <CardHeader>
                <CardTitle>Create New Site</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreate} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Site Name</Label>
                    <Input
                      id="name"
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="orgId">Organization ID</Label>
                    <Input
                      id="orgId"
                      type="text"
                      value={formData.orgId}
                      onChange={(e) => setFormData({ ...formData, orgId: e.target.value })}
                      required
                    />
                  </div>
                  <Button type="submit">Create Site</Button>
                </form>
              </CardContent>
            </Card>
          )}

          {loading ? (
            <Skeleton className="h-96 w-full" />
          ) : (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Organization</TableHead>
                      <TableHead>Site ID</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sites.map((site) => (
                      <TableRow key={site.id}>
                        <TableCell className="font-semibold">{site.name}</TableCell>
                        <TableCell>{site.orgName}</TableCell>
                        <TableCell className="font-mono text-xs">{site.publicSiteId}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(site.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button variant="link" size="sm" asChild>
                              <Link href={`/sites/${site.id}/overview`}>View</Link>
                            </Button>
                            <Button
                              variant="link"
                              size="sm"
                              onClick={() => handleOpenInstallModal(site)}
                            >
                              Get Script
                            </Button>
                            <Button
                              variant="link"
                              size="sm"
                              className="text-destructive"
                              onClick={() => handleDelete(site.id)}
                            >
                              Delete
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {sites.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground">
                          No sites found.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Install Script Modal */}
          <Dialog open={!!selectedSite} onOpenChange={(open) => !open && handleCloseModal()}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Install Script - {selectedSite?.name}</DialogTitle>
                <DialogDescription>
                  Copy and paste this script into your website to start tracking analytics
                </DialogDescription>
              </DialogHeader>

              {scriptLoading ? (
                <div className="py-8 text-center">
                  <Skeleton className="h-32 w-full" />
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Instructions */}
                  <div className="space-y-2">
                    <h3 className="font-semibold">Installation Instructions</h3>
                    <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                      <li>Copy the script below</li>
                      <li>Paste it into the <code className="bg-muted px-1 rounded">&lt;head&gt;</code> section of your website, just before the closing <code className="bg-muted px-1 rounded">&lt;/head&gt;</code> tag</li>
                      <li>The script will automatically start tracking pageviews and events</li>
                      <li>For best performance, place it as high as possible in the <code className="bg-muted px-1 rounded">&lt;head&gt;</code> section</li>
                    </ol>
                  </div>

                  {/* Script Display */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Install Script</Label>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCopyScript}
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
                    <div className="relative">
                      <pre className="bg-muted p-4 rounded-md overflow-x-auto text-xs font-mono">
                        <code>{installScript || 'Loading script...'}</code>
                      </pre>
                    </div>
                  </div>

                  {/* Additional Info */}
                  <div className="space-y-2 border-t pt-4">
                    <h3 className="font-semibold">Site Information</h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Site ID:</span>
                        <p className="font-mono text-xs mt-1">{selectedSite?.publicSiteId}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Write Key:</span>
                        <p className="font-mono text-xs mt-1">{selectedSite?.publicWriteKey}</p>
                      </div>
                    </div>
                  </div>

                  {/* Usage Example */}
                  <div className="space-y-2 border-t pt-4">
                    <h3 className="font-semibold">Usage Example</h3>
                    <p className="text-sm text-muted-foreground">
                      After installation, you can track custom events using:
                    </p>
                    <pre className="bg-muted p-4 rounded-md overflow-x-auto text-xs font-mono">
                      <code>{`// Track a custom event
aa('event', 'button_click', {
  button_name: 'Sign Up',
  page: '/home'
});

// Track a pageview manually
aa('pageview', '/custom-page');`}</code>
                    </pre>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

