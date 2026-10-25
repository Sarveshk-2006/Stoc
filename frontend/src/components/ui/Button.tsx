import React from 'react';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'navy' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode | React.ComponentType<{ className?: string }>;
  iconRight?: React.ReactNode | React.ComponentType<{ className?: string }>;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  iconRight,
  disabled,
  className = '',
  ...props
}) => {
  const sizeMap = {
    sm: 'text-xs px-3 py-1.5 rounded-lg gap-1.5 font-medium',
    md: 'text-xs px-4 py-2 rounded-xl gap-2 font-semibold',
    lg: 'text-sm px-5 py-2.5 rounded-xl gap-2.5 font-semibold',
  };

  const variantMap = {
    primary:
      'bg-[#0D9488] text-white hover:bg-[#0B7C72] active:bg-[#09665E] border border-[#0D9488] shadow-[0_1px_2px_rgba(13,148,136,0.2)]',
    secondary:
      'bg-[#17324D] text-white hover:bg-[#12273C] active:bg-[#0E1F30] border border-[#17324D] shadow-[0_1px_2px_rgba(23,50,77,0.2)]',
    navy:
      'bg-[#17324D] text-white hover:bg-[#12273C] active:bg-[#0E1F30] border border-[#17324D] shadow-[0_1px_2px_rgba(23,50,77,0.2)]',
    outline:
      'bg-white text-[#172B3A] hover:bg-slate-50 active:bg-slate-100 border border-[#E5EAF0] hover:border-[#D0D7DE] shadow-xs',
    ghost:
      'bg-transparent text-[#172B3A] hover:bg-slate-100/70 active:bg-slate-200/60 border border-transparent',
    danger:
      'bg-[#EF4444] text-white hover:bg-[#DC2626] active:bg-[#B91C1C] border border-[#EF4444] shadow-xs',
  };

  const renderIcon = (i: any) => {
    if (!i) return null;
    if (React.isValidElement(i)) return i;
    if (typeof i === 'function' || (typeof i === 'object' && i !== null)) {
      try {
        return React.createElement(i, { className: 'w-3.5 h-3.5 shrink-0' });
      } catch {
        return null;
      }
    }
    return i;
  };

  return (
    <button
      className={`inline-flex items-center justify-center transition-all duration-150 select-none cursor-pointer disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98] ${
        sizeMap[size]
      } ${variantMap[variant]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
      ) : icon ? (
        <span className="shrink-0">{renderIcon(icon)}</span>
      ) : null}
      {children && <span>{children}</span>}
      {!loading && iconRight && <span className="shrink-0">{renderIcon(iconRight)}</span>}
    </button>
  );
};
