'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { toast } from '@/lib/toast';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/app-sidebar';
import { SiteHeader } from '@/components/site-header';
import { getApiUrl } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Copy, Check, Plus } from 'lucide-react';

interface User {
  id: string;
  email: string;
  createdAt: string;
  orgs: Array<{ orgId: string; orgName: string; role: string }>;
}

interface Invitation {
  id: string;
  token: string;
  email: string;
  url: string;
  expiresAt: string;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await fetch(getApiUrl('/api/admin/users'));
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          toast.error('Unauthorized', { description: 'You do not have permission to view users' });
        } else {
          throw new Error('Failed to fetch users');
        }
        setUsers([]);
        return;
      }
      const data = await res.json();
      setUsers(data.users || []);
    } catch (error: any) {
      toast.error('Failed to fetch users', { description: error.message });
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateInvitation = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!inviteEmail.trim()) {
      toast.error('Email is required');
      return;
    }

    setCreatingInvite(true);
    try {
      const res = await fetch(getApiUrl('/api/admin/users/invite'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create invitation');
      }

      const data = await res.json();
      setInvitation(data.invitation);
      toast.success('Invitation created successfully');
    } catch (error: any) {
      toast.error('Failed to create invitation', { description: error.message });
    } finally {
      setCreatingInvite(false);
    }
  };

  const handleCopyLink = async () => {
    if (!invitation?.url) return;
    
    try {
      await navigator.clipboard.writeText(invitation.url);
      setCopied(true);
      toast.success('Invitation link copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error('Failed to copy link');
    }
  };

  const handleCloseDialog = () => {
    setInviteDialogOpen(false);
    setInviteEmail('');
    setInvitation(null);
    setCopied(false);
  };

  if (loading) {
    return (
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <SiteHeader />
          <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
            <div className="p-8">Loading...</div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    );
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">User Management</h1>
            <Dialog open={inviteDialogOpen} onOpenChange={(open) => {
              setInviteDialogOpen(open);
              if (!open) handleCloseDialog();
            }}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Create User Invitation
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>Create User Invitation</DialogTitle>
                  <DialogDescription>
                    Create a new user account by sending them an invitation link. They will be able to set their password when they accept the invitation.
                  </DialogDescription>
                </DialogHeader>
                {!invitation ? (
                  <form onSubmit={handleCreateInvitation} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="email">Email Address</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="user@example.com"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        required
                        disabled={creatingInvite}
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleCloseDialog}
                        disabled={creatingInvite}
                      >
                        Cancel
                      </Button>
                      <Button type="submit" disabled={creatingInvite}>
                        {creatingInvite ? 'Creating...' : 'Create Invitation'}
                      </Button>
                    </div>
                  </form>
                ) : (
                  <div className="space-y-4">
                    <div className="rounded-lg border p-4 bg-muted/50">
                      <p className="text-sm font-medium mb-2">Invitation Link</p>
                      <div className="flex items-center gap-2">
                        <Input
                          value={invitation.url}
                          readOnly
                          className="font-mono text-xs"
                        />
                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          onClick={handleCopyLink}
                        >
                          {copied ? (
                            <Check className="h-4 w-4 text-green-600" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        Send this link to <strong>{invitation.email}</strong>. The invitation expires in 7 days.
                      </p>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setInvitation(null);
                          setInviteEmail('');
                        }}
                      >
                        Create Another
                      </Button>
                      <Button type="button" onClick={handleCloseDialog}>
                        Done
                      </Button>
                    </div>
                  </div>
                )}
              </DialogContent>
            </Dialog>
          </div>
      <div className="bg-white rounded shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-semibold">Email</th>
              <th className="px-4 py-3 text-left text-sm font-semibold">Organizations</th>
              <th className="px-4 py-3 text-left text-sm font-semibold">Created</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-gray-500">
                  No users found.
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user.id} className="border-t">
                  <td className="px-4 py-3">{user.email}</td>
                  <td className="px-4 py-3">
                    {user.orgs && user.orgs.length > 0 ? (
                      <div className="space-y-1">
                        {user.orgs.map((org: any, idx: number) => (
                          <div key={idx} className="text-sm">
                            <span className="font-medium">{org.orgName}</span>
                            <span className="text-gray-500 ml-2">({org.role})</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-gray-400">No organizations</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

