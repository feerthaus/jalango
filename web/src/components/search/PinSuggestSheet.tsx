import { Check, MapPin } from 'lucide-react';
import { useState } from 'react';
import { LocationPicker, type RoadCheck } from '@/components/business/LocationPicker';
import { useLocation } from '@/contexts/LocationContext';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { useT } from '@/lib/i18n';
import { suggestPin } from '@/services/placeSuggestService';
import type { Coordinates } from '@/types';
import { haversineMeters } from '@/utils/geo';

/**
 * Put an address that isn't on the map in the right place: the person drags
 * the pin to the spot and names it. An admin approves it; then searching that
 * text finds it straight away (a JalanGo place).
 */
export function PinSuggestSheet({ query, start, source, onClose }: { query: string; start: Coordinates | null; source: 'user' | 'ai'; onClose: () => void }) {
  const [t] = useT();
  const { fix } = useLocation();
  const [road, setRoad] = useState<RoadCheck | null>(null);
  const [at, setAt] = useState<Coordinates | null>(null);
  const [area, setArea] = useState('');
  const [name, setName] = useState(query.trim().slice(0, 120));
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Started from the AI's landmark (map data we may not keep): the person must place the pin themselves
  const mustMove = source === 'ai' && start !== null;
  const moved = Boolean(at && start && haversineMeters(at, start) > 5);
  // Streets must be pinned on a road drawn on the map (when the map can tell)
  const streetName = /\b(jalan|jln|lorong|lrg|persiaran|lebuh|lebuhraya|lingkaran|road|street)\b/i.test(name);
  const offRoad = streetName && road?.onRoad === false;
  // Sent from within ~150 m of the pin: marked "Ditanda di lokasi" (the server checks; your position isn't kept)
  const here = Boolean(at && fix && fix.accuracy <= 100 && haversineMeters(at, fix.coordinates) <= 150);
  const ready = Boolean(at) && name.trim().length >= 2 && (!mustMove || moved) && !offRoad;

  const send = async () => {
    if (!at || !ready) return;
    setBusy(true);
    setError(null);
    try {
      await suggestPin({ query, name, address: area, at, source, from: fix && fix.accuracy <= 100 ? fix.coordinates : null });
      setDone(true);
    } catch (e) {
      const code = e instanceof Error ? e.message : '';
      setError(
        code === 'rate_limited'
          ? t('Terlalu banyak cadangan hari ini. Cuba esok.', 'Too many suggestions today. Try tomorrow.')
          : code === 'duplicate'
            ? t('Alamat ini sudah dicadangkan di sini dan sedang disemak. Terima kasih!', 'This address was already suggested here and is being checked. Thanks!')
            : t('Tak dapat hantar. Cuba lagi.', 'Couldn’t send. Try again.'),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet title={t('Tanda lokasi di peta', 'Mark the spot on the map')} onClose={onClose}>
      {done ? (
        <div className="py-6 text-center">
          <Check className="mx-auto size-10 text-jade-500" />
          <p className="mt-2 font-semibold">{t('Terima kasih! Bila 2–3 orang berdekatan mengesahkannya (atau admin meluluskannya), sesiapa yang cari alamat ini akan terus jumpa.', 'Thanks! Once 2–3 people nearby confirm it (or an admin approves it), anyone searching this address will find it.')}</p>
          <Button className="mt-4" onClick={onClose}>
            {t('Tutup', 'Close')}
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-ink-600 dark:text-ink-300">
            {t('Gerakkan peta supaya pin tepat pada tempat sebenar. Letak hanya lokasi yang anda tahu.', 'Move the map so the pin sits on the real spot. Only place locations you know.')}
          </p>
          <LocationPicker
            value={start}
            onChange={(c, hint) => {
              setAt(c);
              if (hint) setArea(hint);
            }}
            onRoadCheck={setRoad}
          />
          {road?.onRoad && road.roadName && (
            <p className="text-xs text-ink-500">{t(`Pin di atas jalan yang peta namakan “${road.roadName}”.`, `The pin is on a road the map calls “${road.roadName}”.`)}</p>
          )}
          {offRoad && <p className="text-xs font-semibold text-amber-600">{t('Letak pin betul-betul di atas jalan itu.', 'Put the pin right on the road.')}</p>}
          {at && (
            <p className={here ? 'text-xs font-semibold text-jade-600' : 'text-xs text-ink-500'}>
              {here
                ? t('📍 Anda berada di sini: cadangan akan ditanda "Ditanda di lokasi" dan disahkan lebih cepat.', '📍 You’re here: the suggestion is marked "Marked on site" and gets confirmed faster.')
                : t('Orang berdekatan akan diminta mengesahkan. Jika anda berada di tempat itu, cadangan disahkan lebih cepat.', 'People nearby will be asked to confirm it. If you’re at the spot, it gets confirmed faster.')}
            </p>
          )}
          <label className="block">
            <span className="text-sm font-medium">{t('Nama / alamat', 'Name / address')}</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 120))}
              className="mt-1 w-full rounded-xl bg-ink-100 px-3 py-2 text-base outline-none ring-jade-500 focus:ring-2 dark:bg-ink-800"
              placeholder={t('cth. Jalan P9C/1, Presint 9', 'e.g. Jalan P9C/1, Presint 9')}
            />
          </label>
          {error && (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}
          {mustMove && !moved && <p className="text-xs text-amber-600">{t('Pin bermula di mercu tanda AI. Alihkan ke tempat sebenar alamat ini.', 'The pin starts at the AI’s landmark. Move it to where this address really is.')}</p>}
          <Button className="w-full py-3" onClick={send} disabled={busy || !ready}>
            <MapPin className="size-4" /> {t('Hantar cadangan', 'Send suggestion')}
          </Button>
        </div>
      )}
    </Sheet>
  );
}
