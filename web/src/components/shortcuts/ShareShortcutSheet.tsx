import { CheckCircle2, Loader2, Route as RouteIcon, ShieldCheck, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AuthForm } from '@/components/auth/AuthForm';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/contexts/AuthContext';
import { useShortcuts } from '@/contexts/ShortcutsContext';
import { preparePath, SHORTCUT_PRIVACY_TRIM_M } from '@/services/shortcutsService';
import type { Trip } from '@/types';
import { formatDistance } from '@/utils/geo';

/** Share the road you drove on a trip as a community shortcut. */
export function ShareShortcutSheet({ trip, onClose }: { trip: Trip; onClose: () => void }) {
  const { user } = useAuth();
  const { available, share } = useShortcuts();
  const prepared = useMemo(() => (trip.trace ? preparePath(trip.trace) : null), [trip.trace]);
  const [title, setTitle] = useState('');
  const [avoids, setAvoids] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = async () => {
    if (!prepared) return;
    setBusy(true);
    setError(null);
    try {
      await share({ title, avoids, description, path: prepared.path, distance: prepared.distance });
      setDone(true);
      setTimeout(onClose, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not share the shortcut');
    } finally {
      setBusy(false);
    }
  };

  const input = 'w-full rounded-xl bg-ink-100 px-3 py-2.5 text-base outline-none ring-jade-500 focus:ring-2 dark:bg-ink-800';
  let body: React.ReactNode;
  if (!available) body = <p className="text-sm text-ink-500">Community features aren’t connected yet.</p>;
  else if (!user) body = <AuthForm compact />;
  else if (!prepared)
    body = <p className="text-sm text-ink-500">This trip is too short (or has no recorded path) to share as a shortcut. Shortcuts need at least about 1 km of driving.</p>;
  else if (done)
    body = (
      <div className="flex flex-col items-center py-4 text-center">
        <CheckCircle2 className="size-12 text-jade-500" />
        <p className="mt-2 font-semibold">Shortcut shared — terima kasih!</p>
      </div>
    );
  else
    body = (
      <div className="space-y-3">
        <p className="flex items-center gap-2 rounded-xl bg-ink-100 p-3 text-sm dark:bg-ink-800">
          <RouteIcon className="size-4 shrink-0 text-violet-500" /> {formatDistance(prepared.distance)} of road from your trip to {trip.destination.name}
        </p>
        <input className={input} placeholder="Title, e.g. Elak jem Federal ikut Jalan Klang Lama" maxLength={80} value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Title" />
        <input className={input} placeholder="Avoids (optional), e.g. Federal Highway" maxLength={80} value={avoids} onChange={(e) => setAvoids(e.target.value)} aria-label="Avoids" />
        <textarea className={`${input} resize-none`} rows={2} maxLength={280} placeholder="Tips (optional), e.g. best before 8 am" value={description} onChange={(e) => setDescription(e.target.value)} aria-label="Description" />
        <p className="flex items-start gap-2 text-xs text-ink-500 dark:text-ink-400">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-jade-500" /> The first and last {SHORTCUT_PRIVACY_TRIM_M} m are removed so your home or office isn’t shown.
        </p>
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        <Button className="w-full py-3" onClick={submit} disabled={busy || title.trim().length < 3}>
          {busy && <Loader2 className="size-4 animate-spin" />} Share shortcut
        </Button>
      </div>
    );

  return createPortal(
    <div className="pointer-events-auto fixed inset-0 z-50 flex items-end justify-center bg-ink-950/50 md:items-center" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="share-sc-title" onClick={(e) => e.stopPropagation()} className="safe-bottom max-h-[90dvh] w-full max-w-md animate-slide-up overflow-y-auto rounded-t-3xl bg-white p-5 shadow-float md:rounded-3xl dark:bg-ink-900">
        <div className="mb-4 flex items-center justify-between">
          <h2 id="share-sc-title" className="text-xl font-bold">Share a shortcut</h2>
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
