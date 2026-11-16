import { Box, Square } from 'lucide-react';
import { useMapContext } from '@/contexts/MapContext';
import { cn } from '@/lib/cn';
import { useT } from '@/lib/i18n';

/**
 * Compact 2D/3D switch (one 44 px button so it fits the control stacks on small
 * phones). It shows the current mode; 3D is highlighted. Tap to switch.
 */
export function MapModeToggle({ className }: { className?: string }) {
  const { mapMode, setMapMode } = useMapContext();
  const [t] = useT();
  const is3d = mapMode === '3d';
  return (
    <button
      type="button"
      onClick={() => setMapMode(is3d ? '2d' : '3d')}
      aria-pressed={is3d}
      aria-label={is3d ? t('Paparan peta 3D. Tekan untuk 2D', '3D map view. Tap for 2D') : t('Paparan peta 2D. Tekan untuk 3D', '2D map view. Tap for 3D')}
      title={is3d ? t('Tukar ke 2D', 'Switch to 2D') : t('Tukar ke 3D', 'Switch to 3D')}
      className={cn(
        'pointer-events-auto grid size-11 place-items-center rounded-2xl text-[13px] font-black leading-none shadow-float transition',
        is3d ? 'bg-jade-500 text-ink-950' : 'bg-white text-ink-700 hover:bg-ink-50 dark:bg-ink-800 dark:text-ink-100 dark:hover:bg-ink-700',
        className,
      )}
    >
      <span className="flex flex-col items-center gap-0.5">
        {is3d ? <Box className="size-4" /> : <Square className="size-4" />}
        {is3d ? '3D' : '2D'}
      </span>
    </button>
  );
}
