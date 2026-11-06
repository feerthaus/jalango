import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { features } from '@/lib/config';
import type { Bounds } from '@/services/reportsService';
import { createShortcut, deleteShortcut, fetchMyShortcutVotes, fetchShortcuts, voteShortcut, type NewShortcut } from '@/services/shortcutsService';
import type { Shortcut } from '@/types';
import { boundsAround, boundsContain } from '@/utils/bounds';
import { useAuth } from './AuthContext';
import { useLocation } from './LocationContext';
import { useMapContext } from './MapContext';

interface ShortcutsValue {
  available: boolean;
  shortcuts: Shortcut[];
  loading: boolean;
  error: string | null;
  myVotes: Record<string, 1 | -1>;
  selectedShortcut: Shortcut | null;
  selectShortcut: (s: Shortcut | null) => void;
  share: (s: NewShortcut) => Promise<Shortcut>;
  vote: (id: string, v: 1 | -1) => Promise<void>;
  remove: (id: string) => Promise<void>;
  refresh: () => void;
}

const ShortcutsContext = createContext<ShortcutsValue | null>(null);

export function ShortcutsProvider({ children }: { children: ReactNode }) {
  const available = features.supabase;
  const { user } = useAuth();
  const { map, selectedPlace, clearSelection } = useMapContext();
  const { fix } = useLocation();
  const [list, setList] = useState<Shortcut[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [myVotes, setMyVotes] = useState<Record<string, 1 | -1>>({});
  const [selected, setSelected] = useState<Shortcut | null>(null);
  const [area, setArea] = useState<Bounds | null>(null);
  const [nonce, setNonce] = useState(0);

  // Load shortcuts starting within ~40 km of the map centre (or the driver)
  useEffect(() => {
    if (!available || !map) return;
    const update = () => {
      const c = map.getCenter();
      setArea((prev) => (prev && boundsContain(prev, c.lat, c.lng) ? prev : boundsAround(c.lat, c.lng, 40)));
    };
    update();
    map.on('moveend', update);
    return () => {
      map.off('moveend', update);
    };
  }, [available, map]);

  useEffect(() => {
    if (available && !area && fix) setArea(boundsAround(fix.coordinates.lat, fix.coordinates.lng, 40));
  }, [available, area, fix]);

  useEffect(() => {
    if (!available || !area) return;
    const controller = new AbortController();
    setLoading(true);
    fetchShortcuts(area, controller.signal)
      .then((s) => {
        setList(s);
        setError(null);
      })
      .catch((err: unknown) => !controller.signal.aborted && setError(err instanceof Error ? err.message : 'Could not load shortcuts'))
      .finally(() => !controller.signal.aborted && setLoading(false));
    return () => controller.abort();
  }, [available, area, nonce]);

  const idsKey = list.map((s) => s.id).join(',');
  useEffect(() => {
    if (!user || !idsKey) {
      setMyVotes({});
      return;
    }
    void fetchMyShortcutVotes(idsKey.split(','), user.id).then(setMyVotes);
  }, [user, idsKey]);

  useEffect(() => {
    if (selectedPlace) setSelected(null);
  }, [selectedPlace]);

  const requireUser = useCallback(() => {
    if (!available) throw new Error('Community features are not connected yet.');
    if (!user) throw new Error('Sign in to share and rate shortcuts.');
    return user;
  }, [available, user]);

  const share = useCallback(
    async (s: NewShortcut) => {
      const u = requireUser();
      const created = await createShortcut(s, u.id);
      setList((prev) => [created, ...prev]);
      return created;
    },
    [requireUser],
  );

  const vote = useCallback(
    async (id: string, v: 1 | -1) => {
      const u = requireUser();
      const prevVote = myVotes[id];
      await voteShortcut(id, u.id, v);
      setMyVotes((m) => ({ ...m, [id]: v }));
      const bump = (s: Shortcut): Shortcut => ({
        ...s,
        upvotes: s.upvotes + (v === 1 ? 1 : 0) - (prevVote === 1 ? 1 : 0),
        downvotes: s.downvotes + (v === -1 ? 1 : 0) - (prevVote === -1 ? 1 : 0),
      });
      setList((prev) => prev.map((s) => (s.id === id ? bump(s) : s)));
      setSelected((s) => (s && s.id === id ? bump(s) : s));
    },
    [requireUser, myVotes],
  );

  const remove = useCallback(
    async (id: string) => {
      requireUser();
      await deleteShortcut(id);
      setList((prev) => prev.filter((s) => s.id !== id));
      setSelected((s) => (s?.id === id ? null : s));
    },
    [requireUser],
  );

  const selectShortcut = useCallback(
    (s: Shortcut | null) => {
      setSelected(s);
      if (s) {
        clearSelection();
        if (map) {
          let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
          for (const [lng, lat] of s.path) {
            minLng = Math.min(minLng, lng); minLat = Math.min(minLat, lat);
            maxLng = Math.max(maxLng, lng); maxLat = Math.max(maxLat, lat);
          }
          const h = map.getContainer().clientHeight;
          map.fitBounds([[minLng, minLat], [maxLng, maxLat]], { padding: { top: 90, bottom: Math.min(h * 0.45, 380), left: 40, right: 40 }, maxZoom: 16, duration: 800 });
        }
      }
    },
    [clearSelection, map],
  );

  const value = useMemo<ShortcutsValue>(
    () => ({ available, shortcuts: list, loading, error, myVotes, selectedShortcut: selected, selectShortcut, share, vote, remove, refresh: () => setNonce((n) => n + 1) }),
    [available, list, loading, error, myVotes, selected, selectShortcut, share, vote, remove],
  );
  return <ShortcutsContext.Provider value={value}>{children}</ShortcutsContext.Provider>;
}

export function useShortcuts(): ShortcutsValue {
  const ctx = useContext(ShortcutsContext);
  if (!ctx) throw new Error('useShortcuts must be used within ShortcutsProvider');
  return ctx;
}
