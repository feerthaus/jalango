import { DemoBadge } from '@/components/ui/DemoBadge';
import { useServiceStatus } from '@/contexts/ServiceStatusContext';

/** Persistent, compact label so users always know when data isn't live. */
export function DemoModeBanner() {
  const { isDemo, searchMode, tilesMode } = useServiceStatus();
  if (!isDemo || searchMode === 'checking') return null;
  const parts = [tilesMode === 'demo' && 'open basemap, no traffic layer', searchMode === 'demo' && 'sample search data'].filter(Boolean);
  return (
    <div className="pointer-events-auto inline-flex max-w-full items-center gap-2 rounded-full bg-white/95 py-1 pl-1 pr-3 text-[11px] font-medium text-ink-600 shadow-float dark:bg-ink-900/95 dark:text-ink-300">
      <DemoBadge label="Demo mode" />
      <span className="truncate">{parts.join(' · ')}</span>
    </div>
  );
}
