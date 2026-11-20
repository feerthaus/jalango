import { Check, HelpCircle, MapPin, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation } from '@/contexts/LocationContext';
import { useMapContext } from '@/contexts/MapContext';
import { useT } from '@/lib/i18n';
import { fetchNearbySuggestions, voteSuggestion, type NearbySuggestion } from '@/services/placeSuggestService';
import { formatDistance, haversineMeters } from '@/utils/geo';

const KEY = 'jalango:place-checks-skipped';
const REFRESH_MS = 5 * 60_000;
const MOVE_M = 300;

function skipped(): string[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as string[];
  } catch {
    return [];
  }
}

/**
 * "Betul ini Jalan P9C/1?" — asks signed-in people near a suggested pin to
 * confirm it (only on the map screen, never while navigating). Two or three
 * "Betul" with no "Salah" put it in search for everyone.
 */
export function NearbyCheckCard() {
  const [t] = useT();
  const { user } = useAuth();
  const { fix } = useLocation();
  const { selectPlace } = useMapContext();
  const [items, setItems] = useState<NearbySuggestion[]>([]);
  const [busy, setBusy] = useState(false);
  const [thanks, setThanks] = useState<string | null>(null);
  const last = useRef<{ at: { lat: number; lng: number }; time: number } | null>(null);

  const good = fix && fix.accuracy <= 100 ? fix.coordinates : null;
  useEffect(() => {
    if (!user || !good) return;
    const prev = last.current;
    if (prev && Date.now() - prev.time < REFRESH_MS && haversineMeters(prev.at, good) < MOVE_M) return;
    last.current = { at: good, time: Date.now() };
    const skip = skipped();
    fetchNearbySuggestions(good)
      .then((list) => setItems(list.filter((s) => !skip.includes(s.id))))
      .catch(() => undefined);
  }, [user, good?.lat, good?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  if (thanks) {
    return (
      <div role="status" className="pointer-events-auto flex items-center gap-2 rounded-2xl bg-jade-500 p-3 text-sm font-semibold text-ink-950 shadow-float">
        <Check className="size-5" /> {thanks}
        <button type="button" onClick={() => setThanks(null)} aria-label={t('Tutup', 'Close')} className="ml-auto grid size-7 place-items-center rounded-full hover:bg-ink-950/10">
          <X className="size-4" />
        </button>
      </div>
    );
  }
  const s = items[0];
  if (!user || !good || !s) return null;
  const away = haversineMeters(good, { lat: s.latitude, lng: s.longitude });
  const canVote = away <= 300;
  const next = () => setItems((l) => l.slice(1));

  const vote = async (v: 'yes' | 'no') => {
    setBusy(true);
    try {
      const r = await voteSuggestion(s.id, v, good);
      setThanks(r === 'approved' ? t(`Disahkan! “${s.name}” kini boleh dicari semua orang.`, `Confirmed! “${s.name}” can now be found by everyone.`) : t('Terima kasih kerana membantu!', 'Thanks for helping!'));
      next();
    } catch {
      next();
    } finally {
      setBusy(false);
    }
  };
  const skip = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify([...skipped(), s.id].slice(-100)));
    } catch {
      /* ignore */
    }
    next();
  };

  return (
    <div className="pointer-events-auto rounded-2xl bg-white p-3 shadow-float ring-1 ring-ink-900/5 dark:bg-ink-800 dark:ring-white/10">
      <div className="flex items-start gap-2">
        <MapPin className="mt-0.5 size-5 shrink-0 text-violet-500" />
        <button
          type="button"
          onClick={() => selectPlace({ id: `suggestion:${s.id}`, name: s.name, address: t('Cadangan komuniti, belum disahkan', 'Community suggestion, not confirmed yet'), coordinates: { lat: s.latitude, lng: s.longitude }, kind: 'address', source: 'jalango' })}
          className="min-w-0 flex-1 text-left"
        >
          <span className="block text-sm font-bold">{t(`Betul ini “${s.name}”?`, `Is this “${s.name}”?`)}</span>
          <span className="block text-xs text-ink-500">
            {formatDistance(away)} {t('dari anda · tekan untuk lihat pin', 'from you · tap to see the pin')}
            {s.at_location && ` · ${t('ditanda di lokasi', 'marked on site')}`}
          </span>
        </button>
        <button type="button" onClick={skip} aria-label={t('Langkau', 'Skip')} className="grid size-8 shrink-0 place-items-center rounded-full text-ink-400 hover:bg-ink-100 dark:hover:bg-ink-700">
          <X className="size-4" />
        </button>
      </div>
      {canVote ? (
        <div className="mt-2 grid grid-cols-3 gap-2">
          <button type="button" disabled={busy} onClick={() => void vote('yes')} className="flex items-center justify-center gap-1 rounded-xl bg-jade-500 py-2 text-sm font-bold text-ink-950">
            <Check className="size-4" /> {t('Betul', 'Yes')}
          </button>
          <button type="button" disabled={busy} onClick={() => void vote('no')} className="flex items-center justify-center gap-1 rounded-xl bg-red-600 py-2 text-sm font-bold text-white">
            <X className="size-4" /> {t('Salah', 'No')}
          </button>
          <button type="button" disabled={busy} onClick={skip} className="flex items-center justify-center gap-1 rounded-xl bg-ink-100 py-2 text-sm font-semibold dark:bg-ink-700">
            <HelpCircle className="size-4" /> {t('Tak pasti', 'Not sure')}
          </button>
        </div>
      ) : (
        <p className="mt-1 text-xs text-ink-500">{t('Dekati tempat itu (dalam 300 m) untuk mengesahkan.', 'Get within 300 m of the spot to confirm it.')}</p>
      )}
    </div>
  );
}
