import { NavLink } from 'react-router-dom';
import { Home, Users, Activity, Settings, X } from 'lucide-react';
import { cn } from '../../../utils/cn';
import { Button } from '../../../components/ui/Button';

interface SidebarProps {
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
}

const navigation = [
  { name: 'Home', href: '/homepage', icon: Home },
  { name: 'Clients', href: '/clients', icon: Users },
  { name: 'Simulator', href: '/simulator', icon: Activity },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export const Sidebar = ({ mobileMenuOpen, setMobileMenuOpen }: SidebarProps) => {
  return (
    <>

      <div
        className={cn(
          'fixed inset-0 z-40 bg-background/80 backdrop-blur-sm md:hidden transition-opacity duration-300',
          mobileMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        )}
        onClick={() => setMobileMenuOpen(false)}
      />

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex flex-col w-64 border-r bg-card',
          'transition-transform duration-300 ease-in-out',
          'md:relative md:translate-x-0',
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >

        <div className="flex h-16 shrink-0 items-center justify-between border-b px-4">
          <div className="flex items-center gap-2.5">
            <img src="/logo.png" alt="LimitLab" className="w-8 h-8 shrink-0" />
            <span className="text-lg font-bold bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent">
              LimitLab
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileMenuOpen(false)}
            className="shrink-0 h-8 w-8 md:hidden"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>


        <nav className="flex-1 space-y-1 p-3 overflow-y-auto">
          {navigation.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.name}
                to={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) =>
                  cn(
                    'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-200',
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  )
                }
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span>{item.name}</span>
              </NavLink>
            );
          })}
        </nav>
      </aside>
    </>
  );
};
