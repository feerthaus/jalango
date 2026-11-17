import { CheckCircle2, ExternalLink, Link2, Loader2, MapPin, Navigation } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { useLocation } from '@/contexts/LocationContext';
import { useT } from '@/lib/i18n';
import { placeFromLink, reportSearchMiss } from '@/services/geocodingService';
import type { Place } from '@/types';

/**
 * "Tak jumpa?": tell JalanGo what you were looking for, optionally with a
 * Google Maps link (read for its coordinates only). An admin then fixes the
 * search for everyone. The link's place can be used right away.
 */
export function SearchMissSheet({ query, onClose, onGo }: { query: string; onClose: () => void; onGo: (place: Place) => void }) {
  const [t] = useT();
  const { fix } = useLocation();
  const [looking, setLooking] = useState(query.trim());
  const [note, setNote] = useState('');
  const [link, setLink] = useState('');
  const [found, setFound] = useState<Place | null>(null);
  const [checking, setChecking] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const checkLink = async () => {
    if (!link.trim()) return;
    setChecking(true);
    setLinkError(null);
    setFound(null);
    try {
      const p = await placeFromLink(link, fix?.coordinates ?? null);
      if (p) setFound(p);
      else setLinkError(t('Tak dapat baca lokasi dari pautan ini. Pastikan ia pautan Google Maps ke tempat di Malaysia.', 'Couldn’t read a location from this link. Make sure it’s a Google Maps link to a place in Malaysia.'));
    } catch {
      setLinkError(t('Tak dapat semak pautan sekarang. Cuba lagi.', 'Couldn’t check the link right now. Try again.'));
    } finally {
      setChecking(false);
    }
  };

  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      await reportSearchMiss({
        query: looking.trim().slice(0, 120),
        kind: 'reported',
        note: [note.trim(), found && found.source !== 'link' ? `→ ${found.name}` : ''].filter(Boolean).join(' ').slice(0, 280) || undefined,
        // Coordinates only when the link itself carried them (a name-only link was looked up on the map: not stored)
        hint: found && found.source === 'link' ? { name: found.name.slice(0, 120), lat: found.coordinates.lat, lng: found.coordinates.lng } : undefined,
      });
      setDone(true);
    } catch {
      setError(t('Tak dapat hantar sekarang. Cuba lagi sebentar.', 'Couldn’t send right now. Try again shortly.'));
    } finally {
      setBusy(false);
    }
  };

  const googleHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${looking || query}, Malaysia`)}`;

  return (
    <Sheet title={t('Tak jumpa tempat yang dicari?', 'Can’t find the place?')} onClose={onClose}>
      {done ? (
        <div className="flex flex-col items-center py-2 text-center">
          <CheckCircle2 className="size-12 text-jade-500" />
          <p className="mt-2 font-semibold">{t('Terima kasih! Kami akan betulkan carian ini untuk semua pengguna.', 'Thank you! We’ll fix this search for everyone.')}</p>
          {found && (
            <Button className="mt-4 w-full py-3" onClick={() => onGo(found)}>
              <Navigation className="size-4" /> {t(`Pergi ke ${found.name}`, `Go to ${found.name}`)}
            </Button>
          )}
          <Button variant="ghost" className="mt-2 w-full" onClick={onClose}>
            {t('Tutup', 'Close')}
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-sm font-semibold">{t('Apa yang anda cari?', 'What were you looking for?')}</span>
            <input
              value={looking}
              onChange={(e) => setLooking(e.target.value)}
              maxLength={120}
              className="w-full rounded-xl bg-ink-100 px-3 py-2.5 text-base outline-none ring-jade-500 focus:ring-2 dark:bg-ink-800"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-semibold">{t('Keterangan (pilihan)', 'Details (optional)')}</span>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={280}
              placeholder={t('cth. stesen keretapi, bukan kedai', 'e.g. the train station, not the shop')}
              className="w-full rounded-xl bg-ink-100 px-3 py-2.5 text-base outline-none ring-jade-500 focus:ring-2 dark:bg-ink-800"
            />
          </label>

          <div className="rounded-2xl bg-ink-50 p-3 dark:bg-ink-800/60">
            <p className="flex items-start gap-1.5 text-sm font-semibold">
              <Link2 className="mt-0.5 size-4 shrink-0" /> {t('Ada pautan Google Maps? (pilihan)', 'Have a Google Maps link? (optional)')}
            </p>
            <p className="mt-1 text-xs text-ink-500 dark:text-ink-300">
              {t('Cari di Google Maps, tekan Kongsi → Salin pautan, kemudian tampal di sini. Anda boleh terus ke sana, dan kami guna lokasinya untuk betulkan carian.', 'Find it in Google Maps, tap Share → Copy link, then paste it here. You can go there right away, and we use its location to fix the search.')}
            </p>
            <a href={googleHref} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-jade-700 dark:text-jade-300">
              <ExternalLink className="size-3.5" /> {t('Buka Google Maps', 'Open Google Maps')}
            </a>
            <div className="mt-2 flex gap-2">
              <input
                value={link}
                onChange={(e) => {
                  setLink(e.target.value);
                  setFound(null);
                  setLinkError(null);
                }}
                onBlur={() => void checkLink()}
                inputMode="url"
                placeholder="https://maps.app.goo.gl/…"
                aria-label={t('Pautan Google Maps', 'Google Maps link')}
                className="min-w-0 flex-1 rounded-xl bg-white px-3 py-2 text-sm outline-none ring-jade-500 focus:ring-2 dark:bg-ink-900"
              />
              <Button variant="secondary" className="shrink-0 px-3 py-2 text-xs" disabled={!link.trim() || checking} onClick={() => void checkLink()}>
                {checking ? <Loader2 className="size-4 animate-spin" /> : t('Semak', 'Check')}
              </Button>
            </div>
            {found && (
              <p className="mt-2 flex items-start gap-1.5 text-sm text-jade-700 dark:text-jade-300">
                <MapPin className="mt-0.5 size-4 shrink-0" />
                <span>
                  <strong>{found.name}</strong>
                  {found.address && <span className="block text-xs text-ink-500">{found.address}</span>}
                </span>
              </p>
            )}
            {linkError && <p role="alert" className="mt-2 text-xs text-red-600">{linkError}</p>}
          </div>

          <p className="text-[11px] text-ink-400">{t('Hanya teks carian, keterangan dan lokasi pautan disimpan, tanpa nama atau lokasi anda. Dipadam selepas 90 hari.', 'Only the search text, details and the link’s location are kept, without your name or location. Deleted after 90 days.')}</p>
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            {found && (
              <Button variant="secondary" className="flex-1 py-3" onClick={() => onGo(found)}>
                <Navigation className="size-4" /> {t('Terus ke sana', 'Go there now')}
              </Button>
            )}
            <Button className="flex-1 py-3" disabled={busy || looking.trim().length < 2} onClick={() => void send()}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : t('Hantar', 'Send')}
            </Button>
          </div>
        </div>
      )}
    </Sheet>
  );
}
