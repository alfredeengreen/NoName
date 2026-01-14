'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { UserPlus, ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface TeamMember {
  userId: string;
  email: string;
  role: string;
  createdAt: string;
}

interface TeamMembersCardProps {
  orgId?: string;
}

export function TeamMembersCard({ orgId }: TeamMembersCardProps) {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orgId) {
      setLoading(false);
      return;
    }

    fetch(`/app/api/orgs/${orgId}/members`)
      .then((res) => {
        if (!res.ok) {
          throw new Error('Failed to fetch members');
        }
        return res.json();
      })
      .then((data) => {
        setMembers(data.members || []);
      })
      .catch((error) => {
        console.error('Error fetching team members:', error);
        setMembers([]);
      })
      .finally(() => setLoading(false));
  }, [orgId]);

  const getInitials = (email: string) => {
    const parts = email.split('@')[0].split('.');
    return parts
      .map((part) => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role.toLowerCase()) {
      case 'owner':
      case 'admin':
        return 'default';
      case 'editor':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-48 mt-2" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!orgId) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Team Members</CardTitle>
            <CardDescription className="text-sm mt-1">
              Invite your team members to collaborate.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {members.length === 0 ? (
            <div className="text-center py-6 text-sm text-muted-foreground">
              No team members yet.
            </div>
          ) : (
            members.slice(0, 3).map((member) => (
              <div
                key={member.userId}
                className="flex items-center justify-between p-2 rounded-md hover:bg-accent transition-colors"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-xs">
                      {getInitials(member.email)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="text-sm font-medium truncate">
                      {member.email.split('@')[0]}
                    </span>
                    <span className="text-xs text-muted-foreground truncate">
                      {member.email}
                    </span>
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-7 px-2">
                      <Badge variant={getRoleBadgeVariant(member.role)} className="text-xs">
                        {member.role}
                      </Badge>
                      <ChevronDown className="h-3 w-3 ml-1 opacity-50" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem>Viewer</DropdownMenuItem>
                    <DropdownMenuItem>Editor</DropdownMenuItem>
                    <DropdownMenuItem>Admin</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}

