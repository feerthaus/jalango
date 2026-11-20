import { Check, ExternalLink, Loader2, MapPin, Navigation, Sparkles } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { AuthForm } from '@/components/auth/AuthForm';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation } from '@/contexts/LocationContext';
import { useMapContext } from '@/contexts/MapContext';
import { useRouting } from '@/contexts/RoutingContext';
import { useT } from '@/lib/i18n';
import { ApiError } from '@/services/apiClient';
import { locateWithAi, suggestRedirect, type LocateAnswer, type LocatedPlace } from '@/services/placeSuggestService';
import type { Place } from '@/types';
import { PinSuggestSheet } from './PinSuggestSheet';

const toPlace = (p: LocatedPlace): Place => ({
  id: p.id,
  name: p.name,
  address: p.address,
  coordinates: { lat: p.lat, lng: p.lng },
  kind: 'poi',
  source: p.id.startsWith('jalango:') ? 'jalango' : 'mapbox',
});

/**
 * "Cari alamat dengan AI": for an address the map search can't find, the AI
 * reads the web (never Google Maps) for the area and a landmark next to it, and
 * pins that landmark from our own map. People can then save it for everyone
 * (admins approve), or place the exact pin themselves.
 */
export function AddressFinderSheet({ query, onClose, onDone }: { query: string; onClose: () => void; onDone?: () => void }) {
  const [t, lang] = useT();
  const { user } = useAuth();
  const { fix } = useLocation();
  const { planRoute } = useRouting();
  const { selectPlace } = useMapContext();
  const [answer, setAnswer] = useState<LocateAnswer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [pinning, setPinning] = useState(false);
  const asked = useRef(false);

  useEffect(() => {
    if (!user || asked.current) return;
    asked.current = true;
    setBusy(true);
    locateWithAi(query, fix?.coordinates ?? null, lang)
      .then(setAnswer)
      .catch((e: unknown) => {
        const code = e instanceof ApiError ? e.code : '';
        setError(
          code === 'daily_limit'
            ? t('Had carian AI hari ini sudah habis. Cuba lagi esok.', 'You’ve used today’s AI searches. Try again tomorrow.')
            : t('Carian AI tak dapat dibuat sekarang. Cuba sebentar lagi.', 'The AI search can’t run right now. Try again shortly.'),
        );
      })
      .finally(() => setBusy(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const title = t('Cari alamat dengan AI', 'Find the address with AI');
  if (pinning) {
    const start = answer?.place ? { lat: answer.place.lat, lng: answer.place.lng } : (fix?.coordinates ?? null);
    return <PinSuggestSheet query={query} start={start} source={answer?.place ? 'ai' : 'user'} onClose={onClose} />;
  }
  if (!user) {
    return (
      <Sheet title={title} onClose={onClose}>
        <p className="mb-3 text-sm text-ink-600 dark:text-ink-300">
          {t('AI akan cari alamat ini di web (bukan Google Maps) dan tunjuk mercu tanda terdekat pada peta. Log masuk untuk guna (10 carian sehari).', 'The AI looks this address up on the web (not Google Maps) and shows the nearest landmark on the map. Sign in to use it (10 searches a day).')}
        </p>
        <AuthForm compact />
      </Sheet>
    );
  }

  // Only an exact match is pinned; otherwise no guess (a wrong pin sends drivers to the wrong place)
  const p = answer?.precision === 'exact' ? answer.place : null;

  return (
    <Sheet title={title} onClose={onClose}>
      <p className="mb-3 text-sm text-ink-500">
        “<span className="font-semibold text-ink-800 dark:text-ink-100">{query}</span>”
      </p>
      {busy && (
        <p role="status" className="flex items-center gap-2 py-6 text-sm text-ink-500">
          <Loader2 className="size-4 animate-spin" /> {t('Mencari di web dan pada peta… (10–20 saat)', 'Searching the web and the map… (10–20 seconds)')}
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
      {answer && (
        <div className="space-y-3">
          {answer.note && (
            <p className="flex items-start gap-2 rounded-xl bg-violet-500/10 px-3 py-2 text-sm text-violet-900 dark:text-violet-100">
              <Sparkles className="mt-0.5 size-4 shrink-0" />
              <span>{answer.note}</span>
            </p>
          )}
          {p ? (
            <div className="rounded-2xl bg-ink-100 p-3 dark:bg-ink-800">
              <span className="mb-1 inline-block rounded-full bg-jade-500 px-2 py-0.5 text-[11px] font-bold text-ink-950">{t('Lokasi tepat', 'Exact location')}</span>
              <p className="font-bold">{p.name}</p>
              <p className="text-xs text-ink-500">{p.address}</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button
                  className="py-2"
                  onClick={() => {
                    planRoute(toPlace(p));
                    onDone?.();
                    onClose();
                  }}
                >
                  <Navigation className="size-4" /> {t('Arah', 'Directions')}
                </Button>
                <Button
                  variant="secondary"
                  className="py-2"
                  onClick={() => {
                    selectPlace(toPlace(p));
                    onDone?.();
                    onClose();
                  }}
                >
                  <MapPin className="size-4" /> {t('Lihat di peta', 'Show on map')}
                </Button>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl bg-ink-100 p-3 text-sm dark:bg-ink-800">
              {answer.area && (
                <p>
                  {t('Kawasan:', 'Area:')} <strong>{answer.area}</strong>
                </p>
              )}
              <p className="mt-1 font-semibold">{t('Lokasi tepat tak dapat dipastikan, jadi JalanGo tak meneka.', 'The exact spot couldn’t be confirmed, so JalanGo won’t guess.')}</p>
              <p className="mt-1 text-xs text-ink-500">
                {t('Minta orang di sana kongsi lokasi (WhatsApp atau Google Maps) dan tampal pautannya dalam carian, atau tanda sendiri jika anda tahu tempatnya.', 'Ask someone there to share their location (WhatsApp or Google Maps) and paste the link into search, or mark it yourself if you know the place.')}
              </p>
            </div>
          )}

          <div className="space-y-2 border-t border-ink-100 pt-3 dark:border-ink-800">
            <p className="text-xs font-semibold text-ink-500">{t('Bantu orang lain jumpa alamat ini:', 'Help others find this address:')}</p>
            {p && answer.landmarkQuery && (
              <Button
                variant="secondary"
                className="w-full py-2"
                disabled={saved}
                onClick={async () => {
                  try {
                    await suggestRedirect({ query, name: p.name, targetQuery: answer.landmarkQuery! });
                    setSaved(true);
                  } catch {
                    setError(t('Tak dapat simpan cadangan. Cuba lagi.', 'Couldn’t save the suggestion. Try again.'));
                  }
                }}
              >
                <Check className="size-4" /> {saved ? t('Terima kasih! Admin akan semak.', 'Thanks! An admin will check it.') : t('Betul, cadangkan untuk carian ini', 'Correct: suggest it for this search')}
              </Button>
            )}
            <Button variant="secondary" className="w-full py-2" onClick={() => setPinning(true)}>
              <MapPin className="size-4" /> {t('Tanda lokasi tepat di peta', 'Mark the exact spot on the map')}
            </Button>
          </div>

          {answer.sources.length > 0 && (
            <div className="text-[11px] text-ink-400">
              <p>{t('Sumber web:', 'Web sources:')}</p>
              <ul>
                {answer.sources.map((s) => (
                  <li key={s.url}>
                    <a href={s.url} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 underline">
                      <ExternalLink className="size-3" /> {s.title || new URL(s.url).hostname}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="text-[11px] leading-snug text-ink-400">
            {t('AI hanya memberi pin bila lokasinya tepat, tapi masih boleh tersilap: semak sebelum bertolak. Teks carian dihantar ke Anthropic untuk diproses.', 'The AI only pins exact matches, but can still be wrong: check before you go. The search text is sent to Anthropic to process.')}
            {` ${t(`${answer.remaining} carian AI lagi hari ini.`, `${answer.remaining} AI searches left today.`)}`}
          </p>
        </div>
      )}
    </Sheet>
  );
}
