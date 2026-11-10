import { CheckCircle2, Clock, Loader2, ShieldCheck, Users, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AuthForm } from '@/components/auth/AuthForm';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/contexts/AuthContext';
import { features } from '@/lib/config';
import { useT } from '@/lib/i18n';
import { createCommunityRoute } from '@/services/communityRoutesService';
import type { Trip } from '@/types';
import { COMMUNITY_PRIVACY_TRIM_M, daysAgo, prepareRoutePath } from '@/utils/communityRoutes';
import { formatDuration } from '@/utils/format';
import { formatDistance } from '@/utils/geo';

export const COMMUNITY_SHARE_MAX_DAYS = 60;

/** Can this trip be offered as a community route? (button visibility) */
export function canShareAsCommunityRoute(trip: Trip): boolean {
  return Boolean(trip.trace && trip.arrived && trip.distanceMeters >= 20_000 && daysAgo(trip.startedAt) <= COMMUNITY_SHARE_MAX_DAYS);
}

/** Share a long trip you drove as a community route, with the real time it took. */
export function ShareCommunityRouteSheet({ trip, onClose }: { trip: Trip; onClose: () => void }) {
  const [t] = useT();
  const { user } = useAuth();
  const prepared = useMemo(() => (trip.trace ? prepareRoutePath(trip.trace) : null), [trip.trace]);
  const [title, setTitle] = useState('');
  const [viaLabel, setViaLabel] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = async () => {
    if (!prepared || !user) return;
    setBusy(true);
    setError(null);
    try {
      await createCommunityRoute({ title, viaLabel, note, path: prepared.path, distance: prepared.distance, durationSeconds: trip.durationSeconds, drivenAt: trip.startedAt }, user.id);
      setDone(true);
      setTimeout(onClose, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('Tidak dapat kongsi laluan', 'Could not share the route'));
    } finally {
      setBusy(false);
    }
  };

  const input = 'w-full rounded-xl bg-ink-100 px-3 py-2.5 text-base outline-none ring-sky-500 focus:ring-2 dark:bg-ink-800';
  let body: React.ReactNode;
  if (!features.supabase) body = <p className="text-sm text-ink-500">{t('Ciri komuniti belum disambungkan.', 'Community features aren’t connected yet.')}</p>;
  else if (!user) body = <AuthForm compact />;
  else if (!prepared)
    body = <p className="text-sm text-ink-500">{t('Perjalanan ini terlalu pendek atau tiada laluan dirakam. Laluan komuniti perlu sekurang-kurangnya 20 km.', 'This trip is too short or has no recorded path. Community routes need at least 20 km.')}</p>;
  else if (done)
    body = (
      <div className="flex flex-col items-center py-4 text-center">
        <CheckCircle2 className="size-12 text-jade-500" />
        <p className="mt-2 font-semibold">{t('Laluan dikongsi — terima kasih!', 'Route shared — thank you!')}</p>
      </div>
    );
  else
    body = (
      <div className="space-y-3">
        <div className="rounded-xl bg-ink-100 p-3 text-sm dark:bg-ink-800">
          <p className="font-medium">
            {formatDistance(prepared.distance)} · {t('ke', 'to')} {trip.destination.name}
          </p>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-ink-500">
            <Clock className="size-3.5" /> {t('Masa sebenar anda', 'Your actual time')}: {formatDuration(trip.durationSeconds)} ·{' '}
            {new Date(trip.startedAt).toLocaleDateString('ms-MY', { day: 'numeric', month: 'short' })}
          </p>
        </div>
        <input className={input} placeholder={t('Tajuk, cth. KL → KB ikut Gua Musang, elak LPT', 'Title, e.g. KL → KB via Gua Musang, skip the LPT')} maxLength={80} value={title} onChange={(e) => setTitle(e.target.value)} aria-label={t('Tajuk', 'Title')} />
        <input className={input} placeholder={t('Ikut jalan (pilihan), cth. Bentong – Raub – Gua Musang', 'Via (optional), e.g. Bentong – Raub – Gua Musang')} maxLength={80} value={viaLabel} onChange={(e) => setViaLabel(e.target.value)} aria-label={t('Ikut jalan', 'Via')} />
        <textarea className={`${input} resize-none`} rows={2} maxLength={280} placeholder={t('Tip (pilihan), cth. R&R Gua Musang tutup lewat malam', 'Tips (optional), e.g. few petrol stations after Raub')} value={note} onChange={(e) => setNote(e.target.value)} aria-label={t('Tip', 'Tips')} />
        <p className="flex items-start gap-2 text-xs text-ink-500 dark:text-ink-400">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-jade-500" />
          {t(
            `${COMMUNITY_PRIVACY_TRIM_M / 1000} km pertama dan terakhir dibuang supaya rumah anda tidak kelihatan. Nama anda tidak ditunjukkan.`,
            `The first and last ${COMMUNITY_PRIVACY_TRIM_M / 1000} km are removed so your home isn’t shown. Your name isn’t shown.`,
          )}
        </p>
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
        <Button className="w-full py-3" onClick={submit} disabled={busy || title.trim().length < 3}>
          {busy && <Loader2 className="size-4 animate-spin" />} {t('Kongsi laluan', 'Share route')}
        </Button>
      </div>
    );

  return createPortal(
    <div className="pointer-events-auto fixed inset-0 z-50 flex items-end justify-center bg-ink-950/50 md:items-center" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="share-cr-title" onClick={(e) => e.stopPropagation()} className="safe-bottom max-h-[90dvh] w-full max-w-md animate-slide-up overflow-y-auto rounded-t-3xl bg-white p-5 shadow-float md:rounded-3xl dark:bg-ink-900">
        <div className="mb-4 flex items-center justify-between">
          <h2 id="share-cr-title" className="flex items-center gap-2 text-xl font-bold">
            <Users className="size-5 text-sky-600" /> {t('Kongsi laluan komuniti', 'Share a community route')}
          </h2>
          <button type="button" onClick={onClose} aria-label={t('Tutup', 'Close')} className="grid size-9 place-items-center rounded-full hover:bg-ink-100 dark:hover:bg-ink-800">
            <X className="size-5" />
          </button>
        </div>
        {body}
      </div>
    </div>,
    document.body,
  );
}
