import React from 'react';
import { ChevronRight } from 'lucide-react';
import { NumberTicker } from './ui/NumberTicker';

export interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  change?: string;
  isPositive?: boolean;
  icon?: any;
  iconBg?: string;
  iconColor?: string;
  badge?: string;
  ticker?: boolean;
  statusDotColor?: 'teal' | 'emerald' | 'amber' | 'rose' | 'navy' | 'blue' | 'indigo' | string;
  sparklineColor?: 'teal' | 'amber' | 'red' | 'orange' | 'green' | 'blue';
  secondaryLabel?: string;
  onClick?: () => void;
  className?: string;
}

export const KPICard: React.FC<KPICardProps> = ({
  title,
  value,
  subtitle,
  change,
  isPositive = true,
  icon: Icon,
  iconBg,
  iconColor,
  badge,
  ticker = true,
  statusDotColor = 'teal',
  sparklineColor,
  secondaryLabel,
  onClick,
  className = '',
}) => {
  const numericVal = typeof value === 'number' ? value : parseFloat(String(value).replace(/[^0-9.-]+/g, ''));
  const isNumeric = !isNaN(numericVal) && ticker && !String(value).includes('%') && !String(value).includes('Days') && !String(value).includes('units');

  const dotColorClasses: Record<string, string> = {
    teal: 'bg-[#0D9488]',
    emerald: 'bg-[#059669]',
    amber: 'bg-[#D97706]',
    rose: 'bg-[#DC2626]',
    navy: 'bg-[#17324D]',
    blue: 'bg-[#2563EB]',
    indigo: 'bg-[#4F46E5]',
  };

  const resolvedDotClass = statusDotColor?.startsWith('bg-')
    ? statusDotColor
    : (dotColorClasses[statusDotColor] || 'bg-[#0D9488]');

  const sparklinePaths: Record<string, { path: string; color: string }> = {
    teal: { path: "M2 18 Q 16 22, 28 14 T 48 8 T 62 4", color: "#0D9488" },
    amber: { path: "M2 20 Q 18 16, 32 18 T 50 10 T 62 6", color: "#D97706" },
    red: { path: "M2 12 Q 18 18, 32 14 T 48 20 T 62 16", color: "#DC2626" },
    orange: { path: "M2 19 Q 16 20, 30 15 T 46 11 T 62 7", color: "#EA580C" },
    green: { path: "M2 18 Q 18 20, 32 12 T 48 8 T 62 4", color: "#059669" },
    blue: { path: "M2 16 Q 16 12, 32 16 T 48 8 T 62 6", color: "#2563EB" },
  };

  const spark = sparklineColor ? sparklinePaths[sparklineColor] : null;

  return (
    <div
      onClick={onClick}
      className={`bg-white border border-[#E2E8F0] rounded-2xl p-5 shadow-xs hover:shadow-md transition-all duration-150 flex flex-col justify-between ${
        onClick ? 'cursor-pointer hover:border-[#CBD5E1]' : ''
      } ${className}`}
    >
      {/* Top Header: Icon badge + Title + Chevron or Badge */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          {Icon && (
            <div 
              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                iconBg || 'bg-[#F0FDFA] border-[#CCFBF1] text-[#0D9488]'
              }`}
            >
              {React.isValidElement(Icon)
                ? Icon
                : (typeof Icon === 'function' || (typeof Icon === 'object' && Icon !== null))
                ? React.createElement(Icon as any, { className: `w-4 h-4 ${iconColor || ''}` })
                : null}
            </div>
          )}
          <span className="text-xs font-semibold text-[#64748B] tracking-tight">
            {title}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {badge && (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#0D9488]/10 text-[#0D9488] border border-[#0D9488]/20">
              {badge}
            </span>
          )}
          <ChevronRight className="w-3.5 h-3.5 text-[#94A3B8]" />
        </div>
      </div>

      {/* Main Metric Value */}
      <div className="my-1">
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold tracking-tight text-[#102A43] font-mono-num">
            {isNumeric ? <NumberTicker value={numericVal} /> : value}
          </span>
          {!sparklineColor && (
            <span className={`w-2 h-2 rounded-full shrink-0 ${resolvedDotClass}`} />
          )}
        </div>
        {subtitle && !change && (
          <p className="mt-1 text-xs text-[#64748B] truncate font-normal">
            {subtitle}
          </p>
        )}
      </div>

      {/* Bottom Row: Trend Pill, Secondary Label, and Sparkline */}
      {(change || subtitle || spark) && (
        <div className="flex items-center justify-between pt-2 mt-1 border-t border-[#F8FAFC]">
          <div className="flex items-center gap-2 flex-wrap">
            {change && (
              <span
                className={`text-[11px] font-semibold px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${
                  isPositive
                    ? 'bg-[#ECFDF5] text-[#059669]'
                    : 'bg-[#FEF2F2] text-[#DC2626]'
                }`}
              >
                {change}
              </span>
            )}
            {subtitle && change && (
              <span className="text-[11px] text-[#64748B]">
                {subtitle}
              </span>
            )}
            {secondaryLabel && (
              <span className="text-[11px] text-[#64748B]">
                {secondaryLabel}
              </span>
            )}
          </div>

          {spark && (
            <svg className="w-16 h-6 shrink-0" viewBox="0 0 64 24" fill="none">
              <path
                d={spark.path}
                stroke={spark.color}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </div>
      )}
    </div>
  );
};

export default KPICard;
