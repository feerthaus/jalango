import { useLocation } from '@/contexts/LocationContext';
import { useSpeedLimit } from '@/hooks/useSpeedLimit';
import { cn } from '@/lib/cn';
import { toKmh } from '@/utils/geo';
import { isSpeeding } from '@/utils/speedLimit';
import { useT } from '@/lib/i18n';

/** Current GPS speed, plus the road's speed limit sign while navigating (red when over it). */
export function SpeedIndicator() {
  const [t] = useT();
  const { fix } = useLocation();
  const limit = useSpeedLimit();
  if (!fix || fix.speed === null) return limit !== null ? <LimitSign limit={limit} /> : null;
  const kmh = toKmh(fix.speed);
  const over = isSpeeding(kmh, limit);
  return (
    <div className="pointer-events-auto flex items-end gap-1.5">
      <div
        className={cn(
          'grid size-16 place-items-center rounded-full border-4 shadow-float',
          over ? 'animate-pulse border-red-600 bg-red-600 text-white' : 'border-ink-900 bg-white text-ink-900 dark:border-white dark:bg-ink-900 dark:text-white',
        )}
        aria-label={t(`Kelajuan semasa ${kmh} kilometer sejam${over ? ', melebihi had' : ''}`, `Current speed ${kmh} kilometres per hour${over ? ', over the limit' : ''}`)}
        title={t('Kelajuan GPS', 'GPS speed')}
      >
        <div className="text-center leading-none">
          <div className="text-xl font-black tabular-nums">{kmh}</div>
          <div className={cn('text-[9px] font-semibold uppercase tracking-wider', over ? 'text-white/80' : 'text-ink-500 dark:text-ink-300')}>km/h</div>
        </div>
      </div>
      {limit !== null && <LimitSign limit={limit} />}
    </div>
  );
}

function LimitSign({ limit }: { limit: number }) {
  const [t] = useT();
  return (
    <div
      className="pointer-events-auto grid size-11 place-items-center rounded-full border-[5px] border-red-600 bg-white text-base font-black tabular-nums text-ink-950 shadow-float"
      aria-label={t(`Had laju ${limit}`, `Speed limit ${limit}`)}
      title={t('Had laju (data Mapbox/OpenStreetMap, mungkin tidak tepat)', 'Speed limit (Mapbox/OpenStreetMap data, may be inaccurate)')}
    >
      {limit}
    </div>
  );
}
