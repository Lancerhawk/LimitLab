import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { Button } from './Button';
import { cn } from '../../utils/cn';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

export const Modal = ({ isOpen, onClose, title, description, children, className }: ModalProps) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="fixed inset-0 bg-background/80 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      <div className={cn("relative z-50 w-full max-w-lg max-h-[90vh] flex flex-col rounded-xl border bg-card p-6 shadow-lg sm:rounded-2xl", className)}>
        <div className="flex items-start justify-between mb-4 shrink-0">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
            {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
          </div>
          <Button variant="ghost" size="icon" className="-mt-2 -mr-2 text-muted-foreground hover:text-foreground shrink-0" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>
        <div className="overflow-y-auto overflow-x-hidden pr-2">
          {children}
        </div>
      </div>
    </div>
  );
};
