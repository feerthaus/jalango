import { Compass, Loader2, MapPin, Sparkles, Users, UtensilsCrossed, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AssistantSheet } from '@/components/assistant/AssistantSheet';
import { Sheet } from '@/components/ui/Sheet';
import { useAuth } from '@/contexts/AuthContext';
import { useMapContext } from '@/contexts/MapContext';
import { useT } from '@/lib/i18n';
import { fetchAround, type AroundKind, type AroundPlace } from '@/services/aroundService';
import type { Coordinates } from '@/types';
import { markAroundSeen, setAroundOff, shouldOfferAround } from '@/utils/aroundPrompt';
import { formatDistance } from '@/utils/geo';

/**
 * "Sekitar sini" (POI phase 1): when someone is stopped, offer places to eat and
 * things to see around them, from JalanGo's own data (community picks, then places
 * people confirmed, then the nearest). Once a day per ~1 km area; "Jangan tanya
 * lagi" turns it off. No ratings exist and none are shown.
 */
export function AroundCard({ at }: { at: Coordinates }) {
  const [t] = useT();
  const [show, setShow] = useState(() => shouldOfferAround(at));
  const [kind, setKind] = useState<AroundKind | null>(null);
  if (!show && !kind) return null;
  const close = () => {
    markAroundSeen(at);
    setShow(false);
  };
  return (
    <>
      {show && (
        <div className="pointer-events-auto rounded-2xl bg-white p-3 shadow-float ring-1 ring-ink-900/5 dark:bg-ink-800 dark:ring-white/10">
          <div className="flex items-start gap-2">
            <Compass className="mt-0.5 size-5 shrink-0 text-jade-600" />
            <p className="min-w-0 flex-1 text-sm font-bold">{t('Nak tahu apa ada sekitar sini?', 'Want to know what’s around here?')}</p>
            <button type="button" onClick={close} aria-label={t('Tutup', 'Close')} className="grid size-8 shrink-0 place-items-center rounded-full text-ink-400 hover:bg-ink-100 dark:hover:bg-ink-700">
              <X className="size-4" />
            </button>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => (close(), setKind('makan'))} className="flex items-center justify-center gap-1 rounded-xl bg-jade-500 py-2 text-sm font-bold text-ink-950">
              <UtensilsCrossed className="size-4" /> {t('Tempat makan', 'Places to eat')}
            </button>
            <button type="button" onClick={() => (close(), setKind('menarik'))} className="flex items-center justify-center gap-1 rounded-xl bg-ink-100 py-2 text-sm font-bold dark:bg-ink-700">
              <MapPin className="size-4" /> {t('Tempat menarik', 'Things to see')}
            </button>
          </div>
          <button type="button" onClick={() => (setAroundOff(true), close())} className="mt-2 text-[11px] text-ink-400 underline">
            {t('Jangan tanya lagi', 'Don’t ask again')}
          </button>
        </div>
      )}
      {kind && <AroundSheet at={at} kind={kind} onClose={() => setKind(null)} />}
    </>
  );
}

export function AroundSheet({ at, kind, onClose }: { at: Coordinates; kind: AroundKind; onClose: () => void }) {
  const [t] = useT();
  const { user } = useAuth();
  const { selectPlace } = useMapContext();
  const [list, setList] = useState<AroundPlace[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [asking, setAsking] = useState(false);
  // where the sheet was opened (GPS keeps moving; the list should not reload)
  const [where] = useState(at);
  useEffect(() => {
    const c = new AbortController();
    fetchAround(where, kind, c.signal)
      .then(setList)
      .catch(() => !c.signal.aborted && setFailed(true));
    return () => c.abort();
  }, [where, kind]);

  if (asking) {
    return <AssistantSheet initial={kind === 'makan' ? t('Cadangkan tempat makan sekitar sini', 'Suggest places to eat around here') : t('Cadangkan tempat menarik sekitar sini', 'Suggest things to see around here')} onClose={onClose} />;
  }
  return (
    <Sheet title={kind === 'makan' ? t('Tempat makan sekitar sini', 'Places to eat around here') : t('Tempat menarik sekitar sini', 'Things to see around here')} onClose={onClose}>
      <p className="mb-3 text-xs text-ink-500">
        {t('Daripada data JalanGo: cadangan komuniti dahulu, kemudian tempat yang disahkan pengguna, kemudian yang terdekat. JalanGo tiada rating atau ulasan.', 'From JalanGo’s data: community picks first, then places people confirmed, then the nearest. JalanGo has no ratings or reviews.')}
      </p>
      {!list && !failed && <Loader2 className="mx-auto size-6 animate-spin text-ink-400" />}
      {failed && <p className="text-sm text-ink-500">{t('Tak dapat muat. Cuba lagi.', 'Could not load. Try again.')}</p>}
      {list && list.length === 0 && <p className="text-sm text-ink-500">{t('Belum ada tempat dalam 3 km.', 'No places within 3 km yet.')}</p>}
      {list && list.length > 0 && (
        <ul className="divide-y divide-ink-100 dark:divide-ink-800">
          {list.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => {
                  selectPlace({ id: p.id, name: p.name, address: p.note ?? '', coordinates: { lat: p.lat, lng: p.lng }, kind: 'poi', source: p.source === 'komuniti' ? 'community' : 'osm', unverified: p.unverified || undefined });
                  onClose();
                }}
                className="flex w-full items-start gap-3 py-2.5 text-left"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{p.name}</span>
                  <span className="flex flex-wrap items-center gap-1.5 text-xs text-ink-500">
                    {formatDistance(p.distanceMeters)}
                    {p.recommends > 0 && (
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-jade-500/15 px-1.5 font-semibold text-jade-700 dark:text-jade-300">
                        <Users className="size-3" /> {t(`Disyorkan ${p.recommends} orang`, `Recommended by ${p.recommends}`)}
                      </span>
                    )}
                    {p.source === 'poi' && !p.unverified && p.confirmations > 0 && <span className="rounded-full bg-jade-500/15 px-1.5 font-semibold text-jade-700 dark:text-jade-300">{t(`Disahkan ${p.confirmations} orang`, `Confirmed by ${p.confirmations}`)}</span>}
                    {p.unverified && <span className="rounded-full bg-amber-400/15 px-1.5 font-semibold text-amber-800 dark:text-amber-200">{t('Belum disahkan', 'Not confirmed')}</span>}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {list && list.some((p) => p.source === 'poi') && <p className="mt-2 text-[11px] text-ink-400">{t('Sebahagian data © penyumbang OpenStreetMap', 'Some data © OpenStreetMap contributors')}</p>}
      {user ? (
        <button type="button" onClick={() => setAsking(true)} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-violet-500/10 py-2.5 text-sm font-semibold text-violet-700 dark:text-violet-300">
          <Sparkles className="size-4" /> {t('Tanya pembantu AI', 'Ask the AI assistant')}
        </button>
      ) : (
        <p className="mt-3 text-xs text-ink-500">{t('Log masuk untuk tanya pembantu AI.', 'Sign in to ask the AI assistant.')}</p>
      )}
    </Sheet>
  );
}
