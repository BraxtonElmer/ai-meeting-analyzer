import React from 'react';
import { Link, useLocation } from 'wouter';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';

interface SidebarProps {
  isMobileOpen: boolean;
  setIsMobileOpen: (open: boolean) => void;
}

interface NavItem {
  href: string;
  label: string;
  icon: string;
}

const navItems: NavItem[] = [
  { href: '/', label: 'Dashboard', icon: 'dashboard' },
  { href: '/live-meeting', label: 'Live Meetings', icon: 'record_voice_over' },
  { href: '/past-meetings', label: 'Past Meetings', icon: 'history' },
  { href: '/import-meeting', label: 'Import Meeting', icon: 'add_link' },
  { href: '/reports', label: 'Analytics', icon: 'analytics' },
  { href: '/tasks', label: 'Tasks', icon: 'task_alt' },
  { href: '/settings', label: 'Settings', icon: 'settings' },
];

export function Sidebar({ isMobileOpen, setIsMobileOpen }: SidebarProps) {
  const [location] = useLocation();
  const { user, logoutMutation } = useAuth();

  return (
    <aside
      className={cn(
        'w-64 bg-white shadow-md z-10 transition-all duration-300',
        'fixed md:static h-full',
        isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
      )}
    >
      <div className="flex flex-col h-full">
        {/* Logo */}
        <div className="p-4 border-b">
          <div className="flex items-center space-x-2">
            <span className="material-icons text-primary">smart_toy</span>
            <span className="font-semibold text-lg">AI Meeting Assistant</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-3">
          <ul className="space-y-2">
            {navItems.map((item) => (
              <li key={item.href}>
                <Link 
                  href={item.href}
                  className={cn(
                    'flex items-center px-3 py-2 rounded-md group transition-colors',
                    location === item.href
                      ? 'bg-primary text-white'
                      : 'text-gray-600 hover:bg-gray-100'
                  )}
                  onClick={() => setIsMobileOpen(false)}
                >
                  <span
                    className={cn(
                      'material-icons mr-3',
                      location === item.href
                        ? 'text-white'
                        : 'text-gray-500 group-hover:text-primary'
                    )}
                  >
                    {item.icon}
                  </span>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* User Profile */}
        <div className="p-4 border-t">
          {user ? (
            <div className="space-y-3">
              <div className="flex items-center">
                <div className={`w-10 h-10 rounded-full ${user.avatarColor} flex items-center justify-center text-gray-700`}>
                  {user.avatarInitials}
                </div>
                <div className="ml-3">
                  <p className="font-medium text-sm">{user.fullName}</p>
                  <p className="text-xs text-gray-500">{user.email}</p>
                </div>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full"
                onClick={() => logoutMutation.mutate()}
                disabled={logoutMutation.isPending}
              >
                <span className="material-icons mr-2 text-sm">logout</span>
                {logoutMutation.isPending ? 'Logging out...' : 'Logout'}
              </Button>
            </div>
          ) : (
            <div className="flex justify-center">
              <Link href="/auth" className="text-primary hover:underline text-sm">
                Login or Register
              </Link>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
