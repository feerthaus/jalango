import { useLocation } from '@/contexts/LocationContext';
import { toKmh } from '@/utils/geo';

/** Current speed from the GPS. Hidden when the device doesn't report speed. */
export function SpeedIndicator() {
  const { fix } = useLocation();
  if (!fix || fix.speed === null) return null;
  const kmh = toKmh(fix.speed);
  return (
    <div
      className="pointer-events-auto grid size-16 place-items-center rounded-full border-4 border-ink-900 bg-white text-ink-900 shadow-float dark:border-white dark:bg-ink-900 dark:text-white"
      aria-label={`Current speed ${kmh} kilometres per hour`}
      title="GPS speed"
    >
      <div className="text-center leading-none">
        <div className="text-xl font-black tabular-nums">{kmh}</div>
        <div className="text-[9px] font-semibold uppercase tracking-wider text-ink-500 dark:text-ink-300">km/h</div>
      </div>
    </div>
  );
}
