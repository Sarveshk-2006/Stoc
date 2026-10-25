import React from 'react';

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  category?: string;
  actions?: React.ReactNode;
  className?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  badge,
  category,
  actions,
  className = '',
}) => {
  return (
    <div className={`flex flex-col md:flex-row md:items-center justify-between pb-6 gap-4 border-b border-[#E5EAF0] ${className}`}>
      <div>
        <div className="flex items-center gap-2 mb-1">
          {category && (
            <span className="text-[11px] font-semibold text-[#0D9488] uppercase tracking-wider">
              {category}
            </span>
          )}
          {badge}
        </div>
        <h1 className="text-xl sm:text-2xl font-bold text-[#172B3A] tracking-tight">
          {title}
        </h1>
        {subtitle && (
          <p className="text-xs sm:text-sm text-[#667085] mt-1 max-w-3xl leading-relaxed">
            {subtitle}
          </p>
        )}
      </div>

      {actions && (
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
};
