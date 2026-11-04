import { Info, X } from 'lucide-react';
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { REPORT_TYPES } from '@/lib/reportTypes';

/**
 * Report picker. Phase 1 shows the categories; submitting (with GPS,
 * validation, anti-spam and Supabase Realtime) is wired up in Phase 3.
 */
export function ReportSheet({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Portal so the sheet sits above the navigation bar's stacking context
  return createPortal(
    <div className="pointer-events-auto fixed inset-0 z-50 flex items-end justify-center bg-ink-950/50 md:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-title"
        onClick={(e) => e.stopPropagation()}
        className="safe-bottom w-full max-w-md animate-slide-up rounded-t-3xl bg-white p-5 shadow-float md:rounded-3xl dark:bg-ink-900"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 id="report-title" className="text-xl font-bold">Report on the road</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="grid size-9 place-items-center rounded-full hover:bg-ink-100 dark:hover:bg-ink-800">
            <X className="size-5" />
          </button>
        </div>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {REPORT_TYPES.map(({ type, label, labelMs, icon: Icon, tone }) => (
            <div key={type} className="flex flex-col items-center gap-1.5 text-center opacity-60" aria-disabled>
              <span className={`grid size-14 place-items-center rounded-2xl ${tone}`}>
                <Icon className="size-7" />
              </span>
              <span className="text-xs font-semibold leading-tight">{label}</span>
              <span className="-mt-1 text-[10px] text-ink-400">{labelMs}</span>
            </div>
          ))}
        </div>
        <p className="mt-5 flex items-start gap-2 rounded-xl bg-ink-100 p-3 text-xs text-ink-600 dark:bg-ink-800 dark:text-ink-300">
          <Info className="mt-0.5 size-4 shrink-0" />
          Community reporting is not switched on yet. It launches with sign-in and live updates in the next release — nothing is submitted from this screen.
        </p>
      </div>
    </div>,
    document.body,
  );
}
