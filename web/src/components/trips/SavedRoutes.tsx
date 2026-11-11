import { Bookmark, Check, CornerUpRight, Pencil, Route as RouteIcon, Trash2, Undo2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { useFollowPath } from '@/hooks/useFollowPath';
import { routeFromTrip, useSavedRoutes } from '@/lib/savedRoutes';
import { useT } from '@/lib/i18n';
import type { Trip } from '@/types';
import { formatDuration } from '@/utils/format';
import { formatDistance } from '@/utils/geo';

/** Saved tab: routes kept from your own trips, to drive again or back the same way. */
export function SavedRoutes() {
  const [t] = useT();
  const { routes, remove, rename } = useSavedRoutes();
  const { follow, goBack } = useFollowPath();
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  if (routes.length === 0) {
    return (
      <div className="rounded-2xl bg-white p-2 shadow-sm ring-1 ring-ink-200 dark:bg-ink-900 dark:ring-ink-800">
        <EmptyState icon={Bookmark} title={t('Belum ada laluan disimpan', 'No saved routes yet')}>
          {t('Selepas navigasi, buka tab Perjalanan dan tekan "Simpan laluan". Lain kali anda boleh ikut jalan yang sama, atau balik ikut jalan sama.', 'After a trip, open the Trips tab and tap "Save route". Next time you can drive the same roads again, or back the same way.')}
        </EmptyState>
      </div>
    );
  }
  return (
    <ul className="space-y-2" aria-label={t('Laluan disimpan', 'Saved routes')}>
      {routes.map((r) => (
        <li key={r.id} className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-ink-200 dark:bg-ink-900 dark:ring-ink-800">
          <div className="flex items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-sky-500/15 text-sky-600 dark:text-sky-400">
              <RouteIcon className="size-5" />
            </span>
            {editing === r.id ? (
              <form
                className="flex min-w-0 flex-1 gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  rename(r.id, draft);
                  setEditing(null);
                }}
              >
                <input autoFocus value={draft} maxLength={80} onChange={(e) => setDraft(e.target.value)} aria-label={t('Nama laluan', 'Route name')} className="min-w-0 flex-1 rounded-lg bg-ink-100 px-2 py-1.5 text-base outline-none ring-jade-500 focus:ring-2 dark:bg-ink-800" />
                <button type="submit" aria-label={t('Simpan nama', 'Save name')} className="grid size-9 place-items-center rounded-lg bg-jade-500 text-white">
                  <Check className="size-4" />
                </button>
              </form>
            ) : (
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{r.name}</span>
                <span className="block text-xs text-ink-500">
                  {t('ke', 'to')} {r.destination.name} · {formatDistance(r.distanceMeters)} · {formatDuration(r.durationSeconds)}
                </span>
              </span>
            )}
            {editing !== r.id && (
              <button type="button" onClick={() => { setEditing(r.id); setDraft(r.name); }} aria-label={t('Tukar nama', 'Rename')} className="grid size-9 place-items-center rounded-lg text-ink-400 hover:bg-ink-100 dark:hover:bg-ink-800">
                <Pencil className="size-4" />
              </button>
            )}
          </div>
          <div className="mt-3 grid grid-cols-[1fr_1fr_auto] gap-2">
            <Button className="px-2 text-xs" onClick={() => follow(r.name, r.path, r.destination)}>
              <CornerUpRight className="size-4" /> {t('Ikut laluan', 'Drive it')}
            </Button>
            <Button variant="secondary" className="px-2 text-xs" onClick={() => goBack(r.name, r.path)}>
              <Undo2 className="size-4" /> {t('Balik jalan sama', 'Back same way')}
            </Button>
            <Button variant="danger" className="px-3 text-xs" onClick={() => remove(r.id)} aria-label={t('Padam laluan', 'Delete route')}>
              <Trash2 className="size-4" />
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Buttons inside a trip in history: follow / back / save. */
export function TripRouteActions({ trip }: { trip: Trip }) {
  const [t] = useT();
  const { save, routes } = useSavedRoutes();
  const { follow, goBack } = useFollowPath();
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');
  const [saved, setSaved] = useState(false);
  if (!trip.trace || trip.trace.length < 2 || trip.distanceMeters < 300) return null;
  const trace = trip.trace;
  const full = routes.length >= 30;

  return (
    <div className="space-y-2 rounded-xl bg-sky-500/10 p-2">
      <p className="px-1 text-xs font-semibold text-sky-700 dark:text-sky-300">{t('Laluan yang anda lalui', 'The roads you drove')}</p>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" className="px-2 text-xs" onClick={() => follow(trip.destination.name, trace, trip.destination)}>
          <CornerUpRight className="size-4" /> {t('Ikut laluan ini', 'Drive it again')}
        </Button>
        <Button variant="secondary" className="px-2 text-xs" onClick={() => goBack(trip.destination.name, trace)}>
          <Undo2 className="size-4" /> {t('Balik jalan sama', 'Back same way')}
        </Button>
      </div>
      {saved ? (
        <p className="flex items-center justify-center gap-1 py-1 text-xs font-semibold text-jade-600 dark:text-jade-400">
          <Check className="size-4" /> {t('Disimpan dalam Simpanan → Laluan', 'Saved in Saved → Routes')}
        </p>
      ) : naming ? (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const r = routeFromTrip(trip, name);
            if (r) save(r);
            setSaved(true);
            setNaming(false);
          }}
        >
          <input
            autoFocus
            value={name}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
            placeholder={t(`cth. Rumah → ${trip.destination.name}`, `e.g. Home → ${trip.destination.name}`)}
            aria-label={t('Nama laluan', 'Route name')}
            className="min-w-0 flex-1 rounded-lg bg-white px-2 py-2 text-base outline-none ring-jade-500 focus:ring-2 dark:bg-ink-800"
          />
          <Button className="px-3 text-xs" type="submit">
            {t('Simpan', 'Save')}
          </Button>
        </form>
      ) : (
        <Button variant="ghost" className="w-full text-xs" onClick={() => setNaming(true)} disabled={full}>
          <Bookmark className="size-4" /> {full ? t('Had 30 laluan dicapai', '30-route limit reached') : t('Simpan laluan', 'Save route')}
        </Button>
      )}
    </div>
  );
}
