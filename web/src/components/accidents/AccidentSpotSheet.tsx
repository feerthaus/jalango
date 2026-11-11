import { Moon, Plus, Sun, ThumbsDown, ThumbsUp, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { useAccidents } from '@/contexts/AccidentsContext';
import { useAuth } from '@/contexts/AuthContext';
import { formatDay, outcomeLabel, vehicleLabel } from '@/lib/accidentLabels';
import { cn } from '@/lib/cn';
import { useT } from '@/lib/i18n';
import { photoUrls } from '@/services/accidentService';
import type { AccidentRecord } from '@/types';
import type { Hotspot } from '@/utils/accidentHotspots';
import { AddAccidentSheet } from './AddAccidentSheet';

/** One spot: its accident history, with approved photos, votes and "add a record here". */
export function AccidentSpotSheet({ spot, onClose }: { spot: Hotspot; onClose: () => void }) {
  const [t, lang] = useT();
  const { user } = useAuth();
  const { myVotes, vote, remove } = useAccidents();
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const photoKey = spot.records.map((r) => (r.photo_status === 'approved' || (user && r.user_id === user.id) ? r.photo_path : null)).filter(Boolean).join('|');
  useEffect(() => {
    if (!photoKey) return;
    void photoUrls(photoKey.split('|')).then(setUrls);
  }, [photoKey]);

  const act = async (fn: () => Promise<void>) => {
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('Tidak berjaya', 'Didn’t work'));
    }
  };

  if (adding) return <AddAccidentSheet at={spot.coordinates} onClose={() => setAdding(false)} />;

  return (
    <Sheet title={t('Rekod kemalangan', 'Accident records')} onClose={onClose}>
      <div className={cn('mb-3 rounded-2xl p-3', spot.count >= 2 ? 'bg-red-600 text-white' : 'bg-red-500/10 text-red-800 dark:text-red-200')}>
        <p className="text-lg font-black">
          ⚠ {spot.count} {t('kemalangan direkodkan', spot.count === 1 ? 'crash recorded' : 'crashes recorded')}
          {spot.fatal > 0 && <span> · {spot.fatal} {t('maut', 'fatal')}</span>}
        </p>
        <p className="text-sm opacity-90">
          {spot.count > 1 ? `${formatDay(spot.firstDate, lang)} – ${formatDay(spot.lastDate, lang)}` : formatDay(spot.lastDate, lang)}
          {spot.count >= 2 && ` · ${t('Pandu berhati-hati di sini', 'Drive carefully here')}`}
        </p>
      </div>
      <ol className="space-y-2">
        {spot.records.map((r, i) => (
          <RecordRow
            key={r.id}
            n={spot.records.length - i}
            r={r}
            lang={lang}
            photo={r.photo_path ? urls[r.photo_path] : undefined}
            mine={user?.id === r.user_id}
            myVote={myVotes[r.id]}
            canVote={Boolean(user) && user?.id !== r.user_id}
            onVote={(v) => act(() => vote(r.id, v))}
            onDelete={() => act(() => remove(r.id))}
          />
        ))}
      </ol>
      {error && <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}
      <Button className="mt-4 w-full" onClick={() => setAdding(true)}>
        <Plus className="size-4" /> {t('Tambah rekod kemalangan di sini', 'Add an accident record here')}
      </Button>
      <p className="mt-2 text-center text-[11px] text-ink-400">{t('Rekod daripada pengguna JalanGo, bukan data rasmi PDRM/JKR.', 'Records from JalanGo users, not official police/JKR data.')}</p>
    </Sheet>
  );
}

function RecordRow({ n, r, lang, photo, mine, myVote, canVote, onVote, onDelete }: { n: number; r: AccidentRecord; lang: 'ms' | 'en'; photo?: string; mine: boolean; myVote?: 1 | -1; canVote: boolean; onVote: (v: 1 | -1) => void; onDelete: () => void }) {
  const [t] = useT();
  return (
    <li className="rounded-xl bg-ink-100 p-3 text-sm dark:bg-ink-800">
      <div className="flex items-start gap-2">
        <span className="font-bold tabular-nums text-ink-400">{n}.</span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">
            {formatDay(r.occurred_on, lang)}
            {r.time_of_day && (
              <span className="ml-1.5 inline-flex items-center gap-0.5 text-xs font-normal text-ink-500">
                {r.time_of_day === 'night' ? <Moon className="size-3" /> : <Sun className="size-3" />} {r.time_of_day === 'night' ? t('Malam', 'Night') : t('Siang', 'Day')}
              </span>
            )}
          </p>
          <p className="text-ink-700 dark:text-ink-200">
            {r.vehicles.length ? r.vehicles.map((v) => vehicleLabel(v, lang)).join(' & ') : t('Kenderaan tidak dinyatakan', 'Vehicles not given')} · {outcomeLabel(r.outcome, lang)}
          </p>
          {r.note && <p className="mt-1 text-xs italic text-ink-500">“{r.note}”</p>}
          <p className="mt-1 text-[11px] text-ink-400">{r.source === 'live_report' ? t('Daripada laporan live, disahkan pemandu lain', 'From a live report, confirmed by another driver') : t('Direkod oleh pengguna', 'Recorded by a user')}</p>
        </div>
      </div>
      {photo && (
        <a href={photo} target="_blank" rel="noopener noreferrer" className="mt-2 block">
          <img src={photo} alt={t('Gambar lokasi kemalangan', 'Photo of the crash site')} loading="lazy" className="max-h-56 w-full rounded-lg object-cover" />
        </a>
      )}
      {mine && r.photo_status === 'pending' && <p className="mt-1 text-[11px] text-amber-600">{t('Gambar anda sedang disemak admin.', 'Your photo is waiting for review.')}</p>}
      {mine && r.photo_status === 'rejected' && <p className="mt-1 text-[11px] text-red-600">{t('Gambar anda tidak diluluskan.', 'Your photo was not approved.')}</p>}
      <div className="mt-2 flex items-center gap-1 text-xs">
        <button type="button" disabled={!canVote} onClick={() => onVote(1)} aria-pressed={myVote === 1} className={cn('flex items-center gap-1 rounded-lg px-2 py-1 font-semibold disabled:opacity-50', myVote === 1 ? 'bg-jade-600 text-white' : 'bg-white dark:bg-ink-700')}>
          <ThumbsUp className="size-3.5" /> {t('Betul', 'True')} {r.upvotes}
        </button>
        <button type="button" disabled={!canVote} onClick={() => onVote(-1)} aria-pressed={myVote === -1} className={cn('flex items-center gap-1 rounded-lg px-2 py-1 font-semibold disabled:opacity-50', myVote === -1 ? 'bg-red-600 text-white' : 'bg-white dark:bg-ink-700')}>
          <ThumbsDown className="size-3.5" /> {t('Tak betul', 'Not true')} {r.downvotes}
        </button>
        {mine && (
          <button type="button" onClick={onDelete} aria-label={t('Padam rekod saya', 'Delete my record')} className="ml-auto grid size-8 place-items-center rounded-lg text-ink-400 hover:text-red-600">
            <Trash2 className="size-4" />
          </button>
        )}
      </div>
    </li>
  );
}
