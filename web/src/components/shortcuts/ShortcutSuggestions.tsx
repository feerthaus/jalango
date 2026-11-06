import { Navigation, ThumbsUp, X, Zap } from 'lucide-react';
import { useMemo } from 'react';
import { useRouting } from '@/contexts/RoutingContext';
import { useShortcuts } from '@/contexts/ShortcutsContext';
import { formatDistance } from '@/utils/geo';
import { shortcutsOnRoute } from '@/utils/routeAlerts';
import { buildRouteIndex } from '@/utils/routeProgress';

/**
 * In the route preview: the shortcut in use (with Remove), or community
 * shortcuts that leave and rejoin the chosen route — highlighted when the
 * route is slowed by traffic.
 */
export function ShortcutSuggestions() {
  const { selectedRoute, destination, shortcut, shortcutTitle, applyShortcut, clearShortcut } = useRouting();
  const { shortcuts, selectShortcut } = useShortcuts();

  const suggestions = useMemo(() => {
    if (!selectedRoute || selectedRoute.source === 'demo' || shortcut) return [];
    return shortcutsOnRoute(buildRouteIndex(selectedRoute), shortcuts)
      .sort((a, b) => b.upvotes - b.downvotes - (a.upvotes - a.downvotes))
      .slice(0, 3);
  }, [selectedRoute, shortcuts, shortcut]);

  if (shortcutTitle) {
    return (
      <div className="mb-2 flex items-center gap-2 rounded-2xl bg-violet-500/10 p-3 text-sm">
        <Navigation className="size-4 shrink-0 text-violet-500" />
        <span className="min-w-0 flex-1">
          Via community shortcut <strong className="font-semibold">{shortcutTitle}</strong>
          <span className="block text-xs text-ink-500">Time shown without live traffic for the shortcut part.</span>
        </span>
        <button type="button" onClick={clearShortcut} className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-violet-600 hover:bg-violet-500/10 dark:text-violet-300">
          <X className="size-3.5" /> Remove
        </button>
      </div>
    );
  }
  if (suggestions.length === 0) return null;

  const delay = selectedRoute?.typicalDurationSeconds ? selectedRoute.durationSeconds - selectedRoute.typicalDurationSeconds : 0;
  const jammed = delay > 180 || Boolean(selectedRoute?.congestion?.some((c) => c === 'heavy' || c === 'severe'));

  return (
    <section aria-label="Community shortcuts" className="mb-2 rounded-2xl bg-violet-500/10 p-3">
      <p className="flex items-center gap-1.5 text-sm font-semibold text-violet-700 dark:text-violet-300">
        <Zap className="size-4" /> {jammed ? 'Jalan sesak? Drivers shared shortcuts here' : 'Community shortcuts on this route'}
      </p>
      <ul className="mt-2 space-y-1.5">
        {suggestions.map((s) => (
          <li key={s.id} className="flex items-center gap-2 rounded-xl bg-white p-2 dark:bg-ink-800">
            <button type="button" onClick={() => selectShortcut(s)} className="min-w-0 flex-1 text-left">
              <span className="block truncate text-sm font-medium">{s.title}</span>
              <span className="block truncate text-xs text-ink-500">
                {formatDistance(s.distance_m)}
                {s.avoids && ` · avoids ${s.avoids}`} · <ThumbsUp className="inline size-3" /> {s.upvotes}
              </span>
            </button>
            <button type="button" onClick={() => applyShortcut(s, destination)} className="shrink-0 rounded-lg bg-violet-500 px-3 py-1.5 text-xs font-semibold text-white">
              Use
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
