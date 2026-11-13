import { CreditCard } from 'lucide-react';
import type { TollAlert } from '@/hooks/useTollAlerts';
import { TOLL_PAYMENTS, useTollPayment } from '@/lib/tollPayment';
import { useT } from '@/lib/i18n';
import { formatDistance } from '@/utils/geo';
import { tollTip, tollTitle } from '@/utils/tollAlerts';

/** "Plaza Tol Sungai Besi · 800 m — Guna lorong RFID" under the maneuver banner. */
export function TollBanner({ alert }: { alert: TollAlert }) {
  const [t, lang] = useT();
  const [pay] = useTollPayment();
  const toll = alert.hit.toll;
  const payLabel = TOLL_PAYMENTS.find((p) => p.id === pay);
  return (
    <div role="status" className="pointer-events-auto flex animate-slide-up items-center gap-3 rounded-2xl bg-sky-700 p-3 text-white shadow-float">
      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-white/15">
        <CreditCard className="size-6" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-bold leading-tight">
          {tollTitle(toll, lang)} · {formatDistance(alert.distance)}
        </p>
        <p className="text-xs text-white/90">{tollTip(toll, pay, lang)}</p>
        {!payLabel && toll.type === 'booth' && <p className="text-[11px] text-white/70">{t('Tetapkan cara bayar tol di Profil untuk panduan lorong.', 'Set your toll payment in Profile for lane tips.')}</p>}
      </div>
    </div>
  );
}
