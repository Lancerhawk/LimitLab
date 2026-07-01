import React from 'react';
import { Menu } from 'lucide-react';
import { Button } from '../../../components/ui/Button';

interface TopNavbarProps {
  onMenuClick: () => void;
}

export const TopNavbar = ({ onMenuClick }: TopNavbarProps) => {
  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 w-full items-center justify-between border-b bg-background/95 px-4 md:px-6 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" className="md:hidden text-muted-foreground hover:text-foreground" onClick={onMenuClick}>
          <Menu className="h-5 w-5" />
        </Button>
        <span className="text-sm font-semibold bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent md:hidden">LimitLab</span>
      </div>
      
      {/* Intentionally left blank for ultra-minimalist UI */}
      <div></div>
    </header>
  );
};
