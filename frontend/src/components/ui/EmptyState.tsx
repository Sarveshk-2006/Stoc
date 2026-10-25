import React from 'react';
import { LucideIcon, PackageX } from 'lucide-react';
import { Button } from './Button';

export interface EmptyStateProps {
  icon?: LucideIcon | React.ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon = PackageX,
  title,
  description,
  actionLabel,
  onAction,
  className = '',
}) => {
  return (
    <div className={`flex flex-col items-center justify-center p-8 sm:p-12 text-center rounded-2xl border border-dashed border-[#D0D7DE] bg-slate-50/50 ${className}`}>
      <div className="w-12 h-12 rounded-2xl bg-[#0D9488]/8 border border-[#0D9488]/15 flex items-center justify-center text-[#0D9488] mb-3 shadow-xs">
        {React.isValidElement(Icon) ? (
          Icon
        ) : typeof Icon === 'function' ? (
          React.createElement(Icon as any, { className: 'w-6 h-6' })
        ) : (
          <PackageX className="w-6 h-6" />
        )}
      </div>
      <h3 className="text-sm font-bold text-[#172B3A]">{title}</h3>
      {description && (
        <p className="text-xs text-[#667085] max-w-sm mt-1 leading-relaxed">
          {description}
        </p>
      )}
      {actionLabel && onAction && (
        <Button variant="primary" size="sm" onClick={onAction} className="mt-4">
          {actionLabel}
        </Button>
      )}
    </div>
  );
};
