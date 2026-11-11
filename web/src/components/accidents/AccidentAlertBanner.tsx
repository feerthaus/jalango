import type { AccidentAlert } from '@/hooks/useAccidentAlerts';
import { formatDay } from '@/lib/accidentLabels';
import { useT } from '@/lib/i18n';
import { formatDistance } from '@/utils/geo';

/** "⚠ Kawasan kerap kemalangan · 300 m — 6 kemalangan sejak Jul 2026" under the maneuver banner. */
export function AccidentAlertBanner({ alert }: { alert: AccidentAlert }) {
  const [t, lang] = useT();
  const s = alert.hit.spot;
  return (
    <div role="alert" className="pointer-events-auto flex animate-slide-up items-center gap-3 rounded-2xl bg-red-600 p-3 text-white shadow-float">
      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-white/15 text-2xl" aria-hidden>
        ⚠
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-bold leading-tight">
          {t('Kawasan kerap kemalangan', 'Accident black spot')} · {formatDistance(alert.distance)}
        </p>
        <p className="truncate text-xs text-white/90">
          {s.count} {t('kemalangan', 'crashes')}
          {s.fatal > 0 && ` · ${s.fatal} ${t('maut', 'fatal')}`} · {t('sejak', 'since')} {formatDay(s.firstDate, lang)}
        </p>
      </div>
    </div>
  );
}
