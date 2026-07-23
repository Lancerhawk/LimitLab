import type { ReactNode } from 'react';
import { cn } from '../../utils/cn';
import { Card, CardContent } from '../ui/Card';

interface StatCardProps {
  title: string;
  value: string | number;
  icon?: ReactNode;
  description?: string;
  className?: string;
}

export const StatCard = ({ title, value, icon, description, className }: StatCardProps) => {
  return (
    <Card className={cn('overflow-hidden transition-all hover:border-primary/30 border-border/50 bg-card shadow-sm', className)}>
      <CardContent className="p-6 flex flex-col justify-between h-full">
        <div className="flex items-start justify-between space-y-0 pb-2">
          <p className="text-sm font-medium text-muted-foreground tracking-wide">{title}</p>
          {icon && <div className="text-primary/70 bg-primary/10 p-2 rounded-lg">{icon}</div>}
        </div>
        <div className="flex flex-col gap-1 mt-4">
          <h2 className="text-4xl font-bold tracking-tight text-foreground">{value}</h2>
          {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
        </div>
      </CardContent>
    </Card>
  );
};