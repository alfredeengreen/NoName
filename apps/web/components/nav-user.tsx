'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { User, LogOut, Settings } from 'lucide-react';
import { getApiUrl } from '@/lib/api-client';

interface UserData {
  email: string;
}

export function NavUser() {
  const router = useRouter();
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch user data from API
    fetch(getApiUrl('/api/auth/me'))
      .then((res) => {
        if (res.ok) {
          return res.json();
        }
        return null;
      })
      .then((data) => {
        if (data?.user) {
          setUser(data.user);
        }
      })
      .catch(() => {
        // If no user endpoint, try to get from session
        setUser({ email: 'user@example.com' });
      })
      .finally(() => setLoading(false));
  }, []);

  const handleLogout = async () => {
    try {
      await fetch(getApiUrl('/api/auth/logout'), { method: 'POST' });
      router.push('/login');
    } catch (error) {
      console.error('Logout error:', error);
      router.push('/login');
    }
  };

  const email = user?.email || 'user@example.com';
  const initials = email
    .split('@')[0]
    .split('.')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  if (loading) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-10 w-full justify-start gap-2 px-2">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col items-start flex-1 min-w-0">
            <span className="truncate text-sm font-medium">{email.split('@')[0]}</span>
            <span className="truncate text-xs text-muted-foreground">{email}</span>
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="start" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{email}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => router.push('/settings')}>
          <Settings className="mr-2 h-4 w-4" />
          <span>Settings</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout}>
          <LogOut className="mr-2 h-4 w-4" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

