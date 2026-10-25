import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  hoverEffect?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  className = '',
  padding = 'md',
  hoverEffect = false,
  ...props
}) => {
  const paddingMap = {
    none: 'p-0',
    sm: 'p-4',
    md: 'p-5 sm:p-6',
    lg: 'p-6 sm:p-8',
  };

  return (
    <div
      className={`bg-white border border-[#E5EAF0] rounded-2xl shadow-[0_1px_3px_rgba(16,24,40,0.05),0_1px_2px_rgba(16,24,40,0.04)] ${
        hoverEffect ? 'hover:shadow-[0_4px_14px_rgba(23,50,77,0.07)] hover:border-[#D0D7DE] transition-all duration-150' : ''
      } ${paddingMap[padding]} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

export interface CardHeaderProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  badge?: React.ReactNode;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}

export const CardHeader: React.FC<CardHeaderProps> = ({
  title,
  subtitle,
  badge,
  action,
  icon,
  className = '',
}) => {
  return (
    <div className={`flex items-start justify-between gap-4 pb-4 border-b border-[#F0F4F8] ${className}`}>
      <div className="flex items-center gap-2.5">
        {icon && (
          <div className="w-8 h-8 rounded-lg bg-[#0D9488]/8 border border-[#0D9488]/15 flex items-center justify-center text-[#0D9488] shrink-0">
            {icon}
          </div>
        )}
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-[#172B3A] tracking-tight">{title}</h3>
            {badge}
          </div>
          {subtitle && <p className="text-xs text-[#667085] mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
};
