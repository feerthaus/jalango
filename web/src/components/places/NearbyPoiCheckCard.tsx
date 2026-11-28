import { Check, HelpCircle, MapPinOff, Store, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation } from '@/contexts/LocationContext';
import { useMapContext } from '@/contexts/MapContext';
import { useT } from '@/lib/i18n';
import { fetchNearbyQueue, fetchNearbyUnverified, sendPoiFeedback, type NearbyPoi, type NearbyQueueRecord, type PoiFeedbackKind } from '@/services/poiFeedbackService';
import { AroundCard } from './AroundCard';
import { NearbyQueueQuestion } from './NearbyQueueQuestion';
import { areaFor, loadAreas } from '@/utils/myAreas';
import { formatDistance, haversineMeters } from '@/utils/geo';

const KEY = 'jalango:poi-checks-skipped';
const REFRESH_MS = 5 * 60_000;
const MOVE_M = 300;
/** Faster than this (m/s, ~11 km/h) means moving: never ask */
const STILL_MS = 3;

function skipped(): string[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as string[];
  } catch {
    return [];
  }
}
function remember(id: string) {
  try {
    localStorage.setItem(KEY, JSON.stringify([...skipped(), id].slice(-200)));
  } catch {
    /* ignore */
  }
}

/**
 * POI-5 (option B): "Adakah Klinik Anda di sini?" for signed-in people standing
 * near a JalanGo place nobody has confirmed yet. Only on the map screen, never
 * while moving. Answers go through poi_submit_feedback (two nearby people settle
 * it); the position is used for the distance check only and never stored.
 */
export function NearbyPoiCheckCard() {
  const [t] = useT();
  const { user } = useAuth();
  const { fix } = useLocation();
  const { selectPlace } = useMapContext();
  const [items, setItems] = useState<NearbyPoi[]>([]);
  // Records waiting for review nearby (asked only when no live place needs checking)
  const [queue, setQueue] = useState<NearbyQueueRecord[]>([]);
  const [busy, setBusy] = useState(false);
  const [thanks, setThanks] = useState(false);
  const last = useRef<{ at: { lat: number; lng: number }; time: number } | null>(null);

  const still = fix !== null && (fix.speed === null || fix.speed < STILL_MS);
  const good = fix && fix.accuracy <= 100 && still ? fix.coordinates : null;
  useEffect(() => {
    if (!user || !good) return;
    const prev = last.current;
    if (prev && Date.now() - prev.time < REFRESH_MS && haversineMeters(prev.at, good) < MOVE_M) return;
    last.current = { at: good, time: Date.now() };
    const skip = skipped();
    fetchNearbyUnverified(good)
      .then((list) => setItems(list.filter((p) => !skip.includes(p.id))))
      .catch(() => undefined);
    fetchNearbyQueue(good)
      .then((list) => setQueue(list.filter((r) => !skip.includes(`q:${r.id}`))))
      .catch(() => undefined);
  }, [user, good?.lat, good?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  if (thanks) {
    return (
      <div role="status" className="pointer-events-auto flex items-center gap-2 rounded-2xl bg-jade-500 p-3 text-sm font-semibold text-ink-950 shadow-float">
        <Check className="size-5" /> {t('Terima kasih kerana membantu!', 'Thanks for helping!')}
        <button type="button" onClick={() => setThanks(false)} aria-label={t('Tutup', 'Close')} className="ml-auto grid size-7 place-items-center rounded-full hover:bg-ink-950/10">
          <X className="size-4" />
        </button>
      </div>
    );
  }
  const p = items[0];
  const r = queue[0];
  if (!good) return null;
  // Nothing to check here (or signed out): offer what's around instead ("Sekitar sini")
  if (!user || (!p && !r)) return <AroundCard at={good} />;
  if (!p && r) {
    const nextQ = () => setQueue((l) => l.slice(1));
    return (
      <NearbyQueueQuestion
        key={r.id}
        r={{ ...r, distance_m: Math.round(haversineMeters(good, { lat: r.lat, lng: r.lng })) }}
        at={good}
        area={areaFor({ lat: r.lat, lng: r.lng }, loadAreas())}
        onDone={() => {
          remember(`q:${r.id}`);
          setThanks(true);
          nextQ();
        }}
        onSkip={() => {
          remember(`q:${r.id}`);
          nextQ();
        }}
      />
    );
  }
  if (!p) return null;
  const away = haversineMeters(good, { lat: p.lat, lng: p.lng });
  const near = away <= 300;
  const next = () => setItems((l) => l.slice(1));
  const skip = () => {
    remember(p.id);
    next();
  };
  const answer = async (kind: PoiFeedbackKind) => {
    setBusy(true);
    try {
      await sendPoiFeedback(p.id, kind, good, undefined, areaFor({ lat: p.lat, lng: p.lng }, loadAreas()));
      remember(p.id);
      setThanks(true);
      next();
    } catch {
      next();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pointer-events-auto rounded-2xl bg-white p-3 shadow-float ring-1 ring-ink-900/5 dark:bg-ink-800 dark:ring-white/10">
      <div className="flex items-start gap-2">
        <Store className="mt-0.5 size-5 shrink-0 text-amber-500" />
        <button
          type="button"
          onClick={() => selectPlace({ id: `poi:${p.id}`, name: p.name, address: t('Belum disahkan', 'Not confirmed yet'), coordinates: { lat: p.lat, lng: p.lng }, kind: 'poi', source: 'osm', unverified: true })}
          className="min-w-0 flex-1 text-left"
        >
          <span className="block text-sm font-bold">{t(`Adakah “${p.name}” di sini?`, `Is “${p.name}” here?`)}</span>
          <span className="block text-xs text-ink-500">
            {formatDistance(away)} {t('dari anda · tekan untuk lihat pada peta', 'from you · tap to see it on the map')}
          </span>
        </button>
        <button type="button" onClick={skip} aria-label={t('Langkau', 'Skip')} className="grid size-8 shrink-0 place-items-center rounded-full text-ink-400 hover:bg-ink-100 dark:hover:bg-ink-700">
          <X className="size-4" />
        </button>
      </div>
      {near ? (
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button type="button" disabled={busy} onClick={() => void answer('masih_beroperasi')} className="flex items-center justify-center gap-1 rounded-xl bg-jade-500 py-2 text-sm font-bold text-ink-950">
            <Check className="size-4" /> {t('Ya, ada', 'Yes, it’s here')}
          </button>
          <button type="button" disabled={busy} onClick={() => void answer('sudah_tutup')} className="flex items-center justify-center gap-1 rounded-xl bg-red-600 py-2 text-sm font-bold text-white">
            <Store className="size-4" /> {t('Sudah tutup terus', 'Closed for good')}
          </button>
          <button type="button" disabled={busy} onClick={() => void answer('lokasi_salah')} className="flex items-center justify-center gap-1 rounded-xl bg-ink-100 py-2 text-sm font-semibold dark:bg-ink-700">
            <MapPinOff className="size-4" /> {t('Lokasi salah', 'Wrong place')}
          </button>
          <button type="button" disabled={busy} onClick={skip} className="flex items-center justify-center gap-1 rounded-xl bg-ink-100 py-2 text-sm font-semibold dark:bg-ink-700">
            <HelpCircle className="size-4" /> {t('Tak pasti', 'Not sure')}
          </button>
        </div>
      ) : (
        <p className="mt-1 text-xs text-ink-500">{t('Dekati tempat itu (dalam 300 m) untuk menjawab.', 'Get within 300 m of the place to answer.')}</p>
      )}
    </div>
  );
}
