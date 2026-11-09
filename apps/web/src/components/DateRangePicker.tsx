import React, { useState, useMemo, useEffect } from 'react';
import { Calendar, Sparkles, X, AlertCircle } from 'lucide-react';

export const MAX_SUMMARY_RANGE_DAYS = 90;

interface DateRangePickerProps {
  initialFromDate: string; // YYYY-MM-DD
  initialToDate: string;   // YYYY-MM-DD
  isMobile?: boolean;
  isSubmitting?: boolean;
  onGenerate: (fromUtcIso: string, toUtcIso: string, fromFormatted: string, toFormatted: string) => void;
  onClose: () => void;
}

export const DateRangePicker: React.FC<DateRangePickerProps> = ({
  initialFromDate,
  initialToDate,
  isMobile = false,
  isSubmitting = false,
  onGenerate,
  onClose,
}) => {
  const [fromDate, setFromDate] = useState<string>(initialFromDate);
  const [toDate, setToDate] = useState<string>(initialToDate);

  // Sync if initial dates change
  useEffect(() => {
    if (initialFromDate) setFromDate(initialFromDate);
  }, [initialFromDate]);

  useEffect(() => {
    if (initialToDate) setToDate(initialToDate);
  }, [initialToDate]);

  // Keyboard accessibility: ESC to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Today in YYYY-MM-DD format (local timezone)
  const todayStr = useMemo(() => new Date().toLocaleDateString('en-CA'), []);

  // Validation
  const validationError = useMemo(() => {
    if (!fromDate || !toDate) {
      return 'Please choose both From and To dates.';
    }

    const from = new Date(`${fromDate}T00:00:00`);
    const to = new Date(`${toDate}T23:59:59`);
    const today = new Date(`${todayStr}T23:59:59`);

    if (isNaN(from.getTime()) || isNaN(to.getTime())) {
      return 'Invalid date entered.';
    }

    if (from.getTime() > to.getTime()) {
      return 'From date cannot be after To date.';
    }

    if (to.getTime() > today.getTime() + 1000 * 60 * 60 * 24) {
      return 'Dates cannot be in the future.';
    }

    const diffDays = (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays > MAX_SUMMARY_RANGE_DAYS) {
      return `Date range cannot exceed ${MAX_SUMMARY_RANGE_DAYS} days (selected ${Math.ceil(diffDays)} days).`;
    }

    return null;
  }, [fromDate, toDate, todayStr]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (validationError || isSubmitting) return;

    // Convert local midnight / end-of-day to UTC ISO-8601 strings
    const fromUtc = new Date(`${fromDate}T00:00:00`).toISOString();
    const toUtc = new Date(`${toDate}T23:59:59.999`).toISOString();

    const fromFormatted = new Date(`${fromDate}T00:00:00`).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    const toFormatted = new Date(`${toDate}T00:00:00`).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

    onGenerate(fromUtc, toUtc, fromFormatted, toFormatted);
  };

  const containerClasses = isMobile
    ? 'fixed inset-x-0 bottom-0 z-50 bg-[#17171d] border-t border-[#2e2e38] rounded-t-2xl p-5 shadow-2xl animate-slideUp text-white'
    : 'absolute right-0 bottom-full mb-3 w-80 bg-[#1b1b22] border border-[#2e2e38] rounded-2xl shadow-2xl p-4 z-40 text-white animate-fadeIn';

  return (
    <>
      {isMobile && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs animate-fadeIn"
          onClick={onClose}
        />
      )}

      <div className={containerClasses} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#2e2e38]">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#8b7dff]" />
            <h3 className="text-sm font-bold text-white">Select Summary Range</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-[#8a8a93] hover:text-white hover:bg-white/10 transition"
            aria-label="Close date range selector"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3.5">
          {/* From Date */}
          <div>
            <label className="block text-xs font-semibold text-[#8a8a93] uppercase tracking-wider mb-1">
              From Date
            </label>
            <div className="relative">
              <input
                type="date"
                value={fromDate}
                max={todayStr}
                onChange={(e) => setFromDate(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
                className="w-full bg-[#121217] border border-[#2e2e38] focus:border-[#4f3fd1] rounded-xl px-3 py-2 text-sm text-white outline-none transition"
              />
            </div>
          </div>

          {/* To Date */}
          <div>
            <label className="block text-xs font-semibold text-[#8a8a93] uppercase tracking-wider mb-1">
              To Date
            </label>
            <div className="relative">
              <input
                type="date"
                value={toDate}
                max={todayStr}
                onChange={(e) => setToDate(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
                className="w-full bg-[#121217] border border-[#2e2e38] focus:border-[#4f3fd1] rounded-xl px-3 py-2 text-sm text-white outline-none transition"
              />
            </div>
          </div>

          {/* Validation Error Message */}
          {validationError && (
            <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
              <span>{validationError}</span>
            </div>
          )}

          {/* Actions */}
          <div className="pt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-3 py-2 rounded-xl border border-[#2e2e38] text-xs font-semibold text-[#a5a5ad] hover:text-white hover:bg-white/5 transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => handleSubmit()}
              disabled={!!validationError || isSubmitting}
              className="flex-1 px-3 py-2 rounded-xl bg-[#4f3fd1] hover:bg-[#5d4de0] disabled:opacity-40 disabled:hover:bg-[#4f3fd1] text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm shadow-[#4f3fd1]/30 transition cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {isSubmitting ? 'Generating...' : 'Generate Summary'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

