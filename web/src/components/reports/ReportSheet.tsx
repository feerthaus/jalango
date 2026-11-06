import { ArrowLeft, CheckCircle2, Info, Loader2, MapPin, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AuthForm } from '@/components/auth/AuthForm';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation } from '@/contexts/LocationContext';
import { useReports } from '@/contexts/ReportsContext';
import { REPORT_TYPES, reportMeta } from '@/lib/reportTypes';
import { DESCRIPTION_MAX } from '@/services/reportsService';
import type { ReportType } from '@/types';
import { isInMalaysia } from '@/utils/geo';

/** Report flow: pick type → optional note → submit at the current GPS position. */
export function ReportSheet({ onClose }: { onClose: () => void }) {
  const { available, submit } = useReports();
  const { user, loading: authLoading } = useAuth();
  const { fix, status: gpsStatus, request } = useLocation();
  const [type, setType] = useState<ReportType | null>(null);
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    if (!done) return;
    const id = setTimeout(onClose, 1800);
    return () => clearTimeout(id);
  }, [done, onClose]);

  const send = async () => {
    if (!type || !fix) return;
    setBusy(true);
    setError(null);
    try {
      await submit({ type, description, coordinates: fix.coordinates });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the report');
    } finally {
      setBusy(false);
    }
  };

  const meta = type ? reportMeta(type) : null;
  const poorFix = fix && fix.accuracy > 100;
  const outside = fix && !isInMalaysia(fix.coordinates);

  let body: React.ReactNode;
  if (!available) {
    body = (
      <p className="flex items-start gap-2 rounded-xl bg-ink-100 p-3 text-sm text-ink-600 dark:bg-ink-800 dark:text-ink-300">
        <Info className="mt-0.5 size-4 shrink-0" />
        Community reporting isn’t connected yet (the Supabase database is not configured). Nothing can be submitted.
      </p>
    );
  } else if (authLoading) {
    body = <Loader2 className="mx-auto size-6 animate-spin text-ink-400" />;
  } else if (!user) {
    body = (
      <div className="space-y-3">
        <p className="text-sm text-ink-600 dark:text-ink-300">Sign in so reports can be confirmed and spam kept out.</p>
        <AuthForm compact />
      </div>
    );
  } else if (done && meta) {
    body = (
      <div className="flex flex-col items-center py-4 text-center">
        <CheckCircle2 className="size-12 text-jade-500" />
        <p className="mt-2 font-semibold">Thanks! {meta.label} reported.</p>
        <p className="text-sm text-ink-500">Other drivers nearby can see it now.</p>
      </div>
    );
  } else if (!type) {
    body = (
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
        {REPORT_TYPES.map(({ type: t, label, labelMs, icon: Icon, tone }) => (
          <button key={t} type="button" onClick={() => setType(t)} className="flex flex-col items-center gap-1.5 rounded-2xl p-1 text-center transition hover:bg-ink-100 active:scale-95 dark:hover:bg-ink-800">
            <span className={`grid size-14 place-items-center rounded-2xl ${tone}`}>
              <Icon className="size-7" />
            </span>
            <span className="text-xs font-semibold leading-tight">{label}</span>
            <span className="-mt-1 text-[10px] text-ink-400">{labelMs}</span>
          </button>
        ))}
      </div>
    );
  } else {
    body = (
      <div className="space-y-3">
        <div className="flex items-center gap-3 rounded-2xl bg-ink-100 p-3 dark:bg-ink-800">
          <MapPin className="size-5 shrink-0 text-jade-500" />
          <div className="min-w-0 flex-1 text-sm">
            {fix ? (
              <>
                <p className="font-medium">At your current location</p>
                <p className="text-xs text-ink-500">±{Math.round(fix.accuracy)} m accuracy</p>
              </>
            ) : (
              <>
                <p className="font-medium">Waiting for GPS…</p>
                <p className="text-xs text-ink-500">{gpsStatus === 'denied' ? 'Location is blocked in your browser settings.' : 'Reports are placed at your position.'}</p>
              </>
            )}
          </div>
          {!fix && (
            <Button variant="secondary" className="px-3 py-1.5 text-xs" onClick={request}>
              Enable
            </Button>
          )}
        </div>
        {poorFix && <p className="text-xs text-amber-600">GPS accuracy is low — move to an open area if you can.</p>}
        {outside && <p className="text-xs text-red-600">Reports can only be made inside Malaysia.</p>}
        <label className="block">
          <span className="text-sm font-medium">Details (optional)</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value.slice(0, DESCRIPTION_MAX))}
            rows={3}
            placeholder={meta?.type === 'flood' ? 'e.g. Water knee-deep, left lane blocked' : 'e.g. Left lane blocked'}
            className="mt-1 w-full resize-none rounded-xl bg-ink-100 px-3 py-2 text-base outline-none ring-jade-500 focus:ring-2 dark:bg-ink-800"
          />
          <span className="block text-right text-[11px] text-ink-400">
            {description.length}/{DESCRIPTION_MAX}
          </span>
        </label>
        {error && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
        <Button className="w-full py-3 text-base" onClick={send} disabled={busy || !fix || Boolean(outside)}>
          {busy && <Loader2 className="size-4 animate-spin" />} Report {meta?.label.toLowerCase()}
        </Button>
        <p className="text-center text-[11px] text-ink-400">Only report what you can see. False reports may be removed.</p>
      </div>
    );
  }

  // Portal so the sheet sits above the navigation bar's stacking context
  return createPortal(
    <div className="pointer-events-auto fixed inset-0 z-50 flex items-end justify-center bg-ink-950/50 md:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-title"
        onClick={(e) => e.stopPropagation()}
        className="safe-bottom max-h-[90dvh] w-full max-w-md animate-slide-up overflow-y-auto rounded-t-3xl bg-white p-5 shadow-float md:rounded-3xl dark:bg-ink-900"
      >
        <div className="mb-4 flex items-center gap-2">
          {type && !done && (
            <button type="button" onClick={() => { setType(null); setError(null); }} aria-label="Back" className="grid size-9 place-items-center rounded-full hover:bg-ink-100 dark:hover:bg-ink-800">
              <ArrowLeft className="size-5" />
            </button>
          )}
          <h2 id="report-title" className="flex-1 text-xl font-bold">
            {meta && !done ? meta.label : 'Report on the road'}
          </h2>
          <button type="button" onClick={onClose} aria-label="Close" className="grid size-9 place-items-center rounded-full hover:bg-ink-100 dark:hover:bg-ink-800">
            <X className="size-5" />
          </button>
        </div>
        {body}
      </div>
    </div>,
    document.body,
  );
}
