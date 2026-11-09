import { Check, Copy, MapPinned, MessageCircle, Share2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { Sheet } from '@/components/ui/Sheet';
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
  const [copied, setCopied] = useState(false);
  const url = fix ? spotUrl(fix.coordinates.lat, fix.coordinates.lng) : '';
  const text = t('Saya di sini', "I'm here");

  const onClick = async () => {
    if (!fix) {
      request();
      return;
    }
    // Phones: the native share sheet straight away
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: text, text, url });
        return;
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return; // user closed it
      }
    }
    setOpen(true);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${text}: ${url}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  return (
    <>
      <IconButton label={t('Kongsi lokasi ini', 'Share this spot')} onClick={() => void onClick()}>
        <MapPinned className="size-5 text-sky-600 dark:text-sky-400" />
      </IconButton>
      {open && fix && (
        <Sheet title={t('Kongsi lokasi ini', 'Share this spot')} onClose={() => setOpen(false)}>
          <p className="mb-3 text-sm text-ink-600 dark:text-ink-300">
            {t('Hantar pin lokasi anda sekarang (sekali sahaja, bukan live). Penerima boleh buka di Google Maps atau Waze.', 'Send a pin of where you are now (one-off, not live). It opens in Google Maps on any phone.')}
          </p>
          <p className="mb-3 break-all rounded-xl bg-ink-100 p-3 font-mono text-xs dark:bg-ink-800">{url}</p>
          <div className="grid grid-cols-2 gap-2">
            <a href={`https://wa.me/?text=${encodeURIComponent(`${text}: ${url}`)}`} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-1.5 rounded-xl bg-[#25D366] py-2.5 text-sm font-semibold text-white">
              <MessageCircle className="size-4" /> WhatsApp
            </a>
            <Button variant="secondary" onClick={copy}>
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />} {copied ? t('Disalin', 'Copied') : t('Salin', 'Copy')}
            </Button>
          </div>
          {typeof navigator.share === 'function' && (
            <Button variant="ghost" className="mt-2 w-full" onClick={() => void navigator.share({ title: text, text, url }).catch(() => {})}>
              <Share2 className="size-4" /> {t('Lain-lain', 'More')}
            </Button>
          )}
        </Sheet>
      )}
    </>
  );
}
