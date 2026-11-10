import { MapPinned } from 'lucide-react';
import { useState } from 'react';
import { IconButton } from '@/components/ui/IconButton';
import { ShareSheet } from '@/components/share/ShareSheet';
import { useLocation } from '@/contexts/LocationContext';
import { useT } from '@/lib/i18n';

/** Link that opens on any phone (Google Maps app or website), no JalanGo needed. */
export function spotUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${lat.toFixed(6)},${lng.toFixed(6)}`;
}

/** One tap: send where I am right now (a one-off pin, not live tracking). */
export function ShareSpotButton() {
  const { fix, request } = useLocation();
  const [t] = useT();
  const [open, setOpen] = useState(false);
  const url = fix ? spotUrl(fix.coordinates.lat, fix.coordinates.lng) : '';
  const text = t('Saya di sini', "I'm here");

  const onClick = () => {
    if (!fix) {
      request();
      return;
    }
    setOpen(true);
  };

  return (
    <>
      <IconButton label={t('Kongsi lokasi ini', 'Share this spot')} onClick={onClick}>
        <MapPinned className="size-5 text-sky-600 dark:text-sky-400" />
      </IconButton>
      {open && fix && (
        <ShareSheet heading={t('Kongsi lokasi ini', 'Share this spot')} content={{ title: text, text: `📍 ${text}:`, url }} onClose={() => setOpen(false)}>
          <p className="mb-3 text-sm text-ink-600 dark:text-ink-300">
            {t('Hantar pin lokasi anda sekarang (sekali sahaja, bukan live). Penerima boleh buka di Google Maps atau Waze.', 'Send a pin of where you are now (one-off, not live). It opens in Google Maps on any phone.')}
          </p>
        </ShareSheet>
      )}
    </>
  );
}
