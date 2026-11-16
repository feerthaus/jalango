import { Radio, Share2, X } from 'lucide-react';
import { useState } from 'react';
import { Sheet } from '@/components/ui/Sheet';
import { useLiveShare } from '@/contexts/LiveShareContext';
import { ShareLinkActions } from './ShareLiveSheet';
import { useT } from '@/lib/i18n';

/** "Sharing live location" pill with Stop and re-share. */
export function LiveShareBanner() {
  const [t] = useT();
  const { shares, stop } = useLiveShare();
  const [showLink, setShowLink] = useState(false);
  if (shares.length === 0) return null;
  const s = shares[0];
  const mins = Math.max(1, Math.round((Date.parse(s.expires_at) - Date.now()) / 60_000));
  return (
    <>
      <div role="status" className="pointer-events-auto flex items-center gap-2 rounded-full bg-jade-600 py-1.5 pl-3 pr-1.5 text-xs font-semibold text-white shadow-float">
        <Radio className="size-4 shrink-0 animate-pulse" />
        <span className="min-w-0 flex-1 truncate">
          {t('Berkongsi live', 'Sharing live')}{shares.length > 1 ? t(` (${shares.length} pautan)`, ` (${shares.length} links)`) : ''} · {mins >= 60 ? `${Math.round(mins / 60)} h` : t(`${mins} min`, `${mins} min`)} {t('lagi', 'left')}
        </span>
        <button type="button" onClick={() => setShowLink(true)} aria-label={t('Kongsi pautan semula', 'Share link again')} className="grid size-7 place-items-center rounded-full bg-white/15">
          <Share2 className="size-3.5" />
        </button>
        <button type="button" onClick={() => void Promise.all(shares.map((x) => stop(x.id)))} className="flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-jade-700">
          <X className="size-3.5" /> {t('Henti', 'Stop')}
        </button>
      </div>
      {showLink && (
        <Sheet title={t('Pautan live anda', 'Your live link')} onClose={() => setShowLink(false)}>
          <ShareLinkActions share={s} onDone={() => setShowLink(false)} />
        </Sheet>
      )}
    </>
  );
}
