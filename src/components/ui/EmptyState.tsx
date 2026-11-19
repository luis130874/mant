import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { Plus } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryLabel?: string;
  onSecondaryAction?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  secondaryLabel,
  onSecondaryAction,
  className = '',
}) => {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center px-6 py-12 rounded-xl border border-dashed border-slate-200 dark:border-slate-700/80 prodexus:border-[#244654] bg-slate-50/70 dark:bg-slate-900/40 prodexus:bg-[#132B36]/40 ${className}`}
    >
      <div className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-800 prodexus:bg-[#1B3A47] border border-slate-200/80 dark:border-slate-700 prodexus:border-[#2B5363] shadow-xs flex items-center justify-center mb-3.5 text-slate-400 dark:text-slate-400 prodexus:text-[#7DA4B5]">
        <Icon className="w-6 h-6" />
      </div>
      <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 prodexus:text-white tracking-tight">
        {title}
      </h4>
      <p className="text-xs text-slate-500 dark:text-slate-400 prodexus:text-[#8FB0BE] max-w-md mt-1.5 leading-relaxed">
        {description}
      </p>
      {(actionLabel && onAction) || (secondaryLabel && onSecondaryAction) ? (
        <div className="flex flex-wrap items-center justify-center gap-2.5 mt-5">
          {actionLabel && onAction && (
            <button
              type="button"
              onClick={onAction}
              className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 prodexus:bg-[#2F7CF6] prodexus:hover:bg-[#2566D1] shadow-xs transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4 shrink-0" />
              <span>{actionLabel}</span>
            </button>
          )}
          {secondaryLabel && onSecondaryAction && (
            <button
              type="button"
              onClick={onSecondaryAction}
              className="inline-flex items-center justify-center gap-1.5 min-h-[44px] px-4 py-2 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 prodexus:text-[#D1E3EA] bg-white dark:bg-slate-800 prodexus:bg-[#1B3A47] border border-slate-200 dark:border-slate-700 prodexus:border-[#2B5363] hover:bg-slate-50 dark:hover:bg-slate-700 prodexus:hover:bg-[#224756] transition-colors whitespace-nowrap shrink-0"
            >
              <span>{secondaryLabel}</span>
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
};
