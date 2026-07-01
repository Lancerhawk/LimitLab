import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Users, Activity, SlidersHorizontal, BarChart3, Settings, Menu, X } from 'lucide-react';
import { cn } from '../../../utils/cn';
import { Button } from '../../../components/ui/Button';

interface SidebarProps {
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
}

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Clients', href: '/clients', icon: Users },
  { name: 'Simulator', href: '/simulator', icon: Activity },
  { name: 'Comparison', href: '/comparison', icon: SlidersHorizontal },
  { name: 'Analytics', href: '/analytics', icon: BarChart3 },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export const Sidebar = ({ mobileMenuOpen, setMobileMenuOpen }: SidebarProps) => {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm md:hidden" 
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex flex-col border-r bg-card transition-all duration-300 ease-in-out md:relative',
          mobileMenuOpen ? 'translate-x-0 w-64' : '-translate-x-full md:translate-x-0',
          collapsed && !mobileMenuOpen ? 'md:w-20' : 'md:w-64'
        )}
      >
        <div className="flex h-16 shrink-0 items-center justify-between px-4 border-b">
          <span className={cn(
            "text-lg font-bold bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent transition-opacity duration-200 whitespace-nowrap overflow-hidden",
            (collapsed && !mobileMenuOpen) ? "opacity-0 w-0" : "opacity-100 w-auto"
          )}>
            LimitLab
          </span>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => mobileMenuOpen ? setMobileMenuOpen(false) : setCollapsed(!collapsed)} 
            className={cn("shrink-0", (collapsed && !mobileMenuOpen) && "mx-auto")}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>

        <nav className="flex-1 space-y-1 p-3 overflow-y-auto overflow-x-hidden">
          {navigation.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.name}
                to={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) =>
                  cn(
                    'group flex items-center rounded-md px-3 py-2.5 text-sm font-medium transition-all duration-200',
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                    (collapsed && !mobileMenuOpen) && "justify-center"
                  )
                }
                title={(collapsed && !mobileMenuOpen) ? item.name : undefined}
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span className={cn(
                  "ml-3 whitespace-nowrap transition-all duration-200",
                  (collapsed && !mobileMenuOpen) ? "opacity-0 w-0 hidden" : "opacity-100 w-auto"
                )}>
                  {item.name}
                </span>
              </NavLink>
            );
          })}
        </nav>
      </aside>
    </>
  );
};
