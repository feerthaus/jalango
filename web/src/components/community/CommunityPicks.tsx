import { Plus, ThumbsUp } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { useCommunityPlaces } from '@/contexts/CommunityPlacesContext';
import { useLocation } from '@/contexts/LocationContext';
import { useShowOnMap } from '@/hooks/useShowOnMap';
import { categoryMeta, COMMUNITY_CATEGORIES } from '@/lib/communityCategories';
import { cn } from '@/lib/cn';
import { toPlace } from '@/services/communityPlacesService';
import type { CommunityCategory } from '@/types';
import { formatDistance, haversineMeters } from '@/utils/geo';
import { RecommendPlaceSheet } from './RecommendPlaceSheet';

/** Explore section: best food, attractions… recommended by JalanGo users nearby. */
export function CommunityPicks() {
  const { available, places, loading } = useCommunityPlaces();
  const { fix } = useLocation();
  const showOnMap = useShowOnMap();
  const [filter, setFilter] = useState<CommunityCategory | 'all'>('all');
  const [adding, setAdding] = useState(false);

  const list = useMemo(
    () =>
      places
        .filter((p) => filter === 'all' || p.category === filter)
        .map((p) => ({ p, d: fix ? haversineMeters(fix.coordinates, { lat: p.latitude, lng: p.longitude }) : null }))
        .sort((a, b) => b.p.recommend_count - a.p.recommend_count || (a.d ?? 0) - (b.d ?? 0))
        .slice(0, 12),
    [places, filter, fix],
  );

  if (!available) return null;

  return (
    <>
      <div className="flex items-center justify-between px-1 pb-2 pt-6">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-400">Community picks · best spots</h2>
        <Button variant="ghost" className="px-2 py-1 text-xs" onClick={() => setAdding(true)} disabled={!fix}>
          <Plus className="size-4" /> Share a spot here
        </Button>
      </div>
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2" role="tablist" aria-label="Pick category">
        {[{ id: 'all' as const, label: 'All' }, ...COMMUNITY_CATEGORIES].map((c) => (
          <button
            key={c.id}
            type="button"
            role="tab"
            aria-selected={filter === c.id}
            onClick={() => setFilter(c.id)}
            className={cn('shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold', filter === c.id ? 'bg-jade-500 text-ink-950' : 'bg-white ring-1 ring-ink-200 dark:bg-ink-900 dark:ring-ink-800')}
          >
            {c.label}
          </button>
        ))}
      </div>
      <div className="rounded-2xl bg-white p-2 shadow-sm ring-1 ring-ink-200 dark:bg-ink-900 dark:ring-ink-800">
        {loading && places.length === 0 ? (
          <div className="h-16 animate-pulse rounded-xl bg-ink-100 dark:bg-ink-800" />
        ) : list.length === 0 ? (
          <p className="p-3 text-sm text-ink-500 dark:text-ink-400">
            No picks here yet. Know a great nasi lemak, café or view? Search it and tap <strong>Recommend</strong>, or use <strong>Share a spot here</strong>.
          </p>
        ) : (
          <ul aria-label="Community picks">
            {list.map(({ p, d }) => {
              const meta = categoryMeta(p.category);
              const Icon = meta.icon;
              return (
                <li key={p.id}>
                  <button type="button" onClick={() => showOnMap(toPlace(p))} className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left hover:bg-ink-100 dark:hover:bg-ink-800">
                    <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${meta.tone}`}>
                      <Icon className="size-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{p.name}</span>
                      <span className="block truncate text-xs text-ink-500 dark:text-ink-400">{p.description || meta.label}</span>
                    </span>
                    <span className="shrink-0 text-right text-xs">
                      <span className="flex items-center justify-end gap-1 font-semibold text-jade-600 dark:text-jade-400">
                        <ThumbsUp className="size-3" /> {p.recommend_count}
                      </span>
                      {d !== null && <span className="text-ink-400">{formatDistance(d)}</span>}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {adding && fix && <RecommendPlaceSheet initial={{ name: '', address: '', coordinates: fix.coordinates }} onClose={() => setAdding(false)} />}
    </>
  );
}
