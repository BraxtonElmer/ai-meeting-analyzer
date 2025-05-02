import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface HeaderProps {
  title: string;
  setIsMobileOpen: (open: boolean) => void;
}

export function Header({ title, setIsMobileOpen }: HeaderProps) {
  return (
    <header className="bg-white border-b">
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center">
          <Button
            variant="ghost"
            size="icon"
            className="mr-2 md:hidden"
            onClick={() => setIsMobileOpen(true)}
          >
            <span className="material-icons text-gray-600">menu</span>
          </Button>
          <h1 className="text-xl font-semibold">{title}</h1>
        </div>
        <div className="flex items-center">
          <div className="relative mr-4">
            <Input
              type="text"
              placeholder="Search meetings..."
              className="pl-9 pr-4 py-2 rounded-lg"
            />
            <span className="material-icons absolute left-2 top-2 text-gray-400">
              search
            </span>
          </div>
          <Button variant="ghost" size="icon" className="relative">
            <span className="material-icons text-gray-600">notifications</span>
            <span className="absolute top-1 right-1 w-2 h-2 bg-destructive rounded-full"></span>
          </Button>
        </div>
      </div>
    </header>
  );
}
