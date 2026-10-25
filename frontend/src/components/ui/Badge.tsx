import React from 'react';

export type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'teal' | 'navy' | 'neutral';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: 'sm' | 'md' | 'lg';
  dot?: boolean;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'teal',
  size = 'md',
  dot = false,
  className = '',
}) => {
  const sizeMap = {
    sm: 'text-[10px] px-2 py-0.5 font-medium gap-1',
    md: 'text-xs px-2.5 py-0.5 font-medium gap-1.5',
    lg: 'text-xs px-3 py-1 font-semibold gap-1.5',
  };

  const variantMap: Record<BadgeVariant, { container: string; dot: string }> = {
    success: {
      container: 'bg-[#ECFDF5] text-[#047857] border border-[#A7F3D0]',
      dot: 'bg-[#10B981]',
    },
    warning: {
      container: 'bg-[#FFFBEB] text-[#B45309] border border-[#FDE68A]',
      dot: 'bg-[#F59E0B]',
    },
    danger: {
      container: 'bg-[#FEF2F2] text-[#B91C1C] border border-[#FECACA]',
      dot: 'bg-[#EF4444]',
    },
    info: {
      container: 'bg-[#F0F9FF] text-[#0369A1] border border-[#BAE6FD]',
      dot: 'bg-[#0EA5E9]',
    },
    teal: {
      container: 'bg-[#0D9488]/8 text-[#0D9488] border border-[#0D9488]/25',
      dot: 'bg-[#0D9488]',
    },
    navy: {
      container: 'bg-[#17324D]/6 text-[#17324D] border border-[#17324D]/15',
      dot: 'bg-[#17324D]',
    },
    neutral: {
      container: 'bg-slate-100 text-slate-700 border border-slate-200',
      dot: 'bg-slate-400',
    },
  };

  const style = variantMap[variant] || variantMap.teal;

  return (
    <span
      className={`inline-flex items-center rounded-full leading-none tracking-wide select-none ${sizeMap[size]} ${style.container} ${className}`}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${style.dot}`} />}
      {children}
    </span>
  );
};
