import { MapPinned } from 'lucide-react';
import { useState } from 'react';
import { IconButton } from '@/components/ui/IconButton';
import { ShareSheet } from '@/components/share/ShareSheet';
import { useLocation } from '@/contexts/LocationContext';
import { useT } from '@/lib/i18n';
import { placeUrl } from '@/utils/placeLink';


/** One tap: send where I am right now (a one-off pin, not live tracking). */
export function ShareSpotButton() {
  const { fix, request } = useLocation();
  const [t] = useT();
  const [open, setOpen] = useState(false);
  const text = t('Saya di sini', "I'm here");
  const url = fix ? placeUrl({ name: text, address: '', coordinates: fix.coordinates }) : '';

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
            {t('Hantar pin lokasi anda sekarang (sekali sahaja, bukan live). Pautan dibuka dalam JalanGo, terus boleh tekan Arah.', 'Send a pin of where you are now (one-off, not live). It opens in JalanGo, ready for directions.')}
          </p>
        </ShareSheet>
      )}
    </>
  );
}
