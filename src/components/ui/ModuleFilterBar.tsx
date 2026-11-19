import React, { useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';

export interface FilterStatusOption {
  key: string;
  label: string;
  count?: number;
  tone?: 'neutral' | 'amber' | 'rose' | 'emerald' | 'blue';
}

interface ModuleFilterBarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  statusOptions?: FilterStatusOption[];
  activeStatus?: string;
  onStatusChange?: (key: string) => void;
  totalVisible?: number;
  totalLabel?: string;
  rightSlot?: React.ReactNode;
  enableSlashShortcut?: boolean;
  className?: string;
}

const TONE_ACTIVE: Record<NonNullable<FilterStatusOption['tone']>, string> = {
  neutral:
    'bg-slate-900 text-white border-slate-900 dark:bg-slate-100 dark:text-slate-900 dark:border-slate-100 prodexus:bg-[#2F7CF6] prodexus:text-white prodexus:border-[#2F7CF6]',
  amber:
    'bg-amber-600 text-white border-amber-600 dark:bg-amber-500 dark:text-slate-950 dark:border-amber-500 prodexus:bg-amber-500 prodexus:text-slate-950 prodexus:border-amber-500',
  rose:
    'bg-rose-600 text-white border-rose-600 dark:bg-rose-500 dark:text-white dark:border-rose-500 prodexus:bg-rose-500 prodexus:text-white prodexus:border-rose-500',
  emerald:
    'bg-emerald-600 text-white border-emerald-600 dark:bg-emerald-500 dark:text-slate-950 dark:border-emerald-500 prodexus:bg-[#1FB85C] prodexus:text-white prodexus:border-[#1FB85C]',
  blue:
    'bg-blue-600 text-white border-blue-600 dark:bg-blue-500 dark:text-white dark:border-blue-500 prodexus:bg-[#2F7CF6] prodexus:text-white prodexus:border-[#2F7CF6]',
};

const TONE_DOT: Record<NonNullable<FilterStatusOption['tone']>, string> = {
  neutral: 'bg-slate-400',
  amber: 'bg-amber-500',
  rose: 'bg-rose-500',
  emerald: 'bg-emerald-500',
  blue: 'bg-blue-500',
};

export const ModuleFilterBar: React.FC<ModuleFilterBarProps> = ({
  searchQuery,
  onSearchChange,
  searchPlaceholder = 'Buscar por código, equipo o descripción...',
  statusOptions,
  activeStatus,
  onStatusChange,
  totalVisible,
  totalLabel = 'registros',
  rightSlot,
  enableSlashShortcut = true,
  className = '',
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!enableSlashShortcut) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }
      e.preventDefault();
      inputRef.current?.focus();
      inputRef.current?.select();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enableSlashShortcut]);

  return (
    <div
      className={`cmms-card p-3 sm:p-3.5 flex flex-col gap-3 ${className}`}
    >
      <div className="flex flex-col lg:flex-row lg:items-center gap-2.5 justify-between">
        {/* Búsqueda con atajo '/' */}
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-slate-400 dark:text-slate-400 prodexus:text-[#7DA4B5] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                if (searchQuery) {
                  e.stopPropagation();
                  onSearchChange('');
                } else {
                  inputRef.current?.blur();
                }
              }
            }}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            className="w-full min-h-[44px] pl-9 pr-12 py-2 text-xs sm:text-[13px] rounded-lg border border-slate-200 dark:border-slate-700 prodexus:border-[#244654] bg-white dark:bg-slate-900 prodexus:bg-[#0D212A] text-slate-800 dark:text-slate-100 prodexus:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 prodexus:placeholder:text-[#668B9B] focus:outline-none focus:ring-2 focus:ring-blue-500/40 prodexus:focus:ring-[#2F7CF6]/50 transition-shadow"
          />
          {searchQuery ? (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              aria-label="Limpiar búsqueda"
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 prodexus:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 prodexus:hover:bg-[#1B3A47] transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          ) : enableSlashShortcut ? (
            <kbd
              title="Presione / para buscar rápidamente"
              className="hidden sm:inline-flex items-center justify-center absolute right-2.5 top-1/2 -translate-y-1/2 px-1.5 py-0.5 text-[11px] font-mono font-semibold text-slate-400 dark:text-slate-400 prodexus:text-[#7DA4B5] bg-slate-100 dark:bg-slate-800 prodexus:bg-[#132B36] border border-slate-200 dark:border-slate-700 prodexus:border-[#244654] rounded pointer-events-none"
            >
              /
            </kbd>
          ) : null}
        </div>

        {/* Slot derecho (selectores extra, totales) */}
        {(rightSlot || typeof totalVisible === 'number') && (
          <div className="flex flex-wrap items-center gap-2">
            {rightSlot}
            {typeof totalVisible === 'number' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold tabular-nums bg-slate-100 dark:bg-slate-800/80 prodexus:bg-[#132B36] text-slate-600 dark:text-slate-300 prodexus:text-[#9CBAC7] border border-slate-200/80 dark:border-slate-700 prodexus:border-[#244654] whitespace-nowrap shrink-0">
                <strong className="font-bold text-slate-900 dark:text-white prodexus:text-white">
                  {totalVisible}
                </strong>
                <span>{totalLabel}</span>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Filtros rápidos de estado con contadores */}
      {statusOptions && statusOptions.length > 0 && onStatusChange && (
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          {statusOptions.map((opt) => {
            const isActive = activeStatus === opt.key;
            const tone = opt.tone || 'neutral';
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => onStatusChange(opt.key)}
                className={`inline-flex items-center gap-2 min-h-[38px] sm:min-h-[34px] px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all whitespace-nowrap shrink-0 ${
                  isActive
                    ? TONE_ACTIVE[tone]
                    : 'bg-white dark:bg-slate-800/60 prodexus:bg-[#132B36]/80 text-slate-600 dark:text-slate-300 prodexus:text-[#B4CED9] border-slate-200 dark:border-slate-700 prodexus:border-[#244654] hover:bg-slate-50 dark:hover:bg-slate-800 prodexus:hover:bg-[#1B3A47]'
                }`}
              >
                {!isActive && opt.tone && opt.tone !== 'neutral' && (
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${TONE_DOT[tone]}`} />
                )}
                <span>{opt.label}</span>
                {typeof opt.count === 'number' && (
                  <span
                    className={`px-1.5 py-0.5 rounded-md text-[11px] font-bold tabular-nums leading-none ${
                      isActive
                        ? 'bg-white/20 text-current'
                        : 'bg-slate-100 dark:bg-slate-700 prodexus:bg-[#1B3A47] text-slate-700 dark:text-slate-200 prodexus:text-white'
                    }`}
                  >
                    {opt.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
