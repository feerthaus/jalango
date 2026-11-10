import { Clock, Loader2, ThumbsDown, ThumbsUp, Users } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouting } from '@/contexts/RoutingContext';
import { features } from '@/lib/config';
import { cn } from '@/lib/cn';
import { useT } from '@/lib/i18n';
import { fetchCommunityRoutes, fetchMyCommunityRouteVotes, voteCommunityRoute } from '@/services/communityRoutesService';
import type { CommunityRoute, Coordinates } from '@/types';
import { COMMUNITY_MIN_M, daysAgo, suggestCommunityRoutes } from '@/utils/communityRoutes';
import { formatDuration } from '@/utils/format';
import { formatDistance } from '@/utils/geo';
import { buildRouteIndex } from '@/utils/routeProgress';

// One fetch per trip (rounded ends), not per reroute
const cache = new Map<string, Promise<CommunityRoute[]>>();
function load(from: Coordinates, to: Coordinates): Promise<CommunityRoute[]> {
  const key = [from.lat, from.lng, to.lat, to.lng].map((n) => n.toFixed(2)).join(',');
  let p = cache.get(key);
  if (!p) {
    p = fetchCommunityRoutes(from, to).catch((err) => {
      cache.delete(key);
      throw err;
    });
    cache.set(key, p);
  }
  return p;
}

/**
 * In the route preview for long trips (balik kampung): alternatives other
 * drivers actually took between roughly the same places, with the time
 * they really needed, so you can skip the jam on the main highway.
 */
export function CommunityRouteSuggestions() {
  const [t] = useT();
  const { user } = useAuth();
  const { selectedRoute, destination, shortcutTitle, applyCommunityRoute } = useRouting();
  const [list, setList] = useState<CommunityRoute[]>([]);
  const [loading, setLoading] = useState(false);
  const [votes, setVotes] = useState<Record<string, 1 | -1>>({});
  const [voteError, setVoteError] = useState<string | null>(null);

  const eligible = features.supabase && !!selectedRoute && selectedRoute.source !== 'demo' && !!destination && !shortcutTitle && selectedRoute.distanceMeters >= COMMUNITY_MIN_M;
  const first = selectedRoute?.geometry.coordinates[0];
  const from = useMemo<Coordinates | null>(() => (first ? { lng: first[0], lat: first[1] } : null), [first?.[0], first?.[1]]); // eslint-disable-line react-hooks/exhaustive-deps
  const to = destination?.coordinates ?? null;

  useEffect(() => {
    if (!eligible || !from || !to) return;
    let alive = true;
    setLoading(true);
    load(from, to)
      .then((rows) => alive && setList(rows), () => alive && setList([]))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [eligible, from, to]);

  const suggestions = useMemo(() => {
    if (!eligible || !selectedRoute || !from || !to || list.length === 0) return [];
    return suggestCommunityRoutes(buildRouteIndex(selectedRoute), from, to, list);
  }, [eligible, selectedRoute, from, to, list]);

  useEffect(() => {
    if (!user || suggestions.length === 0) return;
    fetchMyCommunityRouteVotes(suggestions.map((s) => s.route.id), user.id).then(setVotes, () => {});
  }, [user, suggestions]);

  if (!eligible) return null;
  if (loading && suggestions.length === 0) {
    return (
      <p className="mb-2 flex items-center gap-2 px-1 text-xs text-ink-500">
        <Loader2 className="size-3.5 animate-spin" /> {t('Mencari laluan komuniti…', 'Looking for community routes…')}
      </p>
    );
  }
  if (suggestions.length === 0) return null;

  const delay = selectedRoute?.typicalDurationSeconds ? selectedRoute.durationSeconds - selectedRoute.typicalDurationSeconds : 0;
  const jammed = delay > 600 || Boolean(selectedRoute?.congestion?.some((c) => c === 'heavy' || c === 'severe'));

  const vote = async (r: CommunityRoute, v: 1 | -1) => {
    if (!user) return;
    setVoteError(null);
    const prev = votes[r.id];
    setVotes((m) => ({ ...m, [r.id]: v }));
    setList((rows) =>
      rows.map((x) => {
        if (x.id !== r.id) return x;
        const up = x.upvotes - (prev === 1 ? 1 : 0) + (v === 1 ? 1 : 0);
        const down = x.downvotes - (prev === -1 ? 1 : 0) + (v === -1 ? 1 : 0);
        return { ...x, upvotes: up, downvotes: down };
      }),
    );
    try {
      await voteCommunityRoute(r.id, user.id, v);
    } catch (err) {
      setVotes((m) => ({ ...m, [r.id]: prev }));
      setList((rows) => rows.map((x) => (x.id === r.id ? r : x)));
      setVoteError(err instanceof Error ? err.message : t('Undi gagal', 'Vote failed'));
    }
  };

  return (
    <section aria-label={t('Laluan komuniti', 'Community routes')} className="mb-2 rounded-2xl bg-sky-500/10 p-3">
      <p className="flex items-center gap-1.5 text-sm font-semibold text-sky-700 dark:text-sky-300">
        <Users className="size-4" />
        {jammed ? t('Jem? Pemandu lain ikut jalan ini', 'Jammed? Other drivers took these roads') : t('Laluan alternatif dari komuniti', 'Alternative routes from the community')}
      </p>
      <ul className="mt-2 space-y-1.5">
        {suggestions.map(({ route: r }) => {
          const faster = selectedRoute ? selectedRoute.durationSeconds - r.duration_s : 0;
          const d = daysAgo(r.driven_at);
          const mine = user?.id === r.user_id;
          return (
            <li key={r.id} className="rounded-xl bg-white p-2.5 dark:bg-ink-800">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{r.title}</p>
                  {r.via_label && <p className="truncate text-xs text-ink-500">{t('Ikut', 'Via')} {r.via_label}</p>}
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-ink-500">
                    <span>{formatDistance(r.distance_m)}</span>·
                    <span className="flex items-center gap-0.5">
                      <Clock className="size-3" /> {formatDuration(r.duration_s)} {t('sebenar', 'actual')}
                    </span>
                    ·<span>{d === 0 ? t('hari ini', 'today') : t(`${d} hari lalu`, `${d} days ago`)}</span>
                  </p>
                  {faster > 15 * 60 && (
                    <p className="mt-0.5 text-xs font-semibold text-jade-600 dark:text-jade-400">
                      {t(`~${formatDuration(faster)} lebih cepat daripada anggaran sekarang`, `~${formatDuration(faster)} quicker than the current estimate`)}
                    </p>
                  )}
                  {r.note && <p className="mt-1 line-clamp-2 text-xs italic text-ink-600 dark:text-ink-300">“{r.note}”</p>}
                </div>
                <button type="button" onClick={() => applyCommunityRoute(r)} className="shrink-0 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white">
                  {t('Guna', 'Use')}
                </button>
              </div>
              <div className="mt-1.5 flex items-center gap-1 text-xs">
                <VoteButton active={votes[r.id] === 1} disabled={!user || mine} onClick={() => vote(r, 1)} label={t('Bagus', 'Helpful')}>
                  <ThumbsUp className="size-3.5" /> {r.upvotes}
                </VoteButton>
                <VoteButton active={votes[r.id] === -1} disabled={!user || mine} onClick={() => vote(r, -1)} label={t('Tak bagus', 'Not helpful')}>
                  <ThumbsDown className="size-3.5" /> {r.downvotes}
                </VoteButton>
                {!user && <span className="ml-1 text-[11px] text-ink-400">{t('Log masuk untuk undi', 'Sign in to vote')}</span>}
              </div>
            </li>
          );
        })}
      </ul>
      {voteError && (
        <p role="alert" className="mt-1 text-xs text-red-600">
          {voteError}
        </p>
      )}
      <p className="mt-1.5 text-[11px] text-ink-500">
        {t('Masa ialah apa yang pemandu itu alami pada hari itu, bukan ramalan. Masa laluan selepas dipilih tidak mengira trafik langsung.', 'Times are what that driver experienced on that day, not a forecast. Once chosen, the route time doesn’t include live traffic.')}
      </p>
    </section>
  );
}

function VoteButton({ active, disabled, onClick, label, children }: { active: boolean; disabled: boolean; onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active}
      className={cn('flex items-center gap-1 rounded-lg px-2 py-1 font-semibold disabled:opacity-50', active ? 'bg-sky-600 text-white' : 'bg-ink-100 text-ink-600 dark:bg-ink-700 dark:text-ink-200')}
    >
      {children}
    </button>
  );
}
