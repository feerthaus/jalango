import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { features } from '@/lib/config';
import {
  createCommunityPlace,
  deleteCommunityPlace,
  fetchCommunityPlaces,
  fetchMyRecommendations,
  setRecommendation,
  type NewCommunityPlace,
} from '@/services/communityPlacesService';
import type { Bounds } from '@/services/reportsService';
import type { CommunityPlace } from '@/types';
import { boundsAround, boundsContain } from '@/utils/bounds';
import { useAuth } from './AuthContext';
import { useLocation } from './LocationContext';
import { useMapContext } from './MapContext';

interface CommunityPlacesValue {
  available: boolean;
  places: CommunityPlace[];
  loading: boolean;
  error: string | null;
  recommended: Set<string>;
  add: (p: NewCommunityPlace) => Promise<CommunityPlace>;
  toggleRecommend: (id: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  findById: (id: string) => CommunityPlace | undefined;
}

const CommunityPlacesContext = createContext<CommunityPlacesValue | null>(null);

export function CommunityPlacesProvider({ children }: { children: ReactNode }) {
  const available = features.supabase;
  const { user } = useAuth();
  const { map } = useMapContext();
  const { fix } = useLocation();
  const [places, setPlaces] = useState<CommunityPlace[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recommended, setRecommended] = useState<Set<string>>(new Set());
  const [area, setArea] = useState<Bounds | null>(null);

  useEffect(() => {
    if (!available || !map) return;
    const update = () => {
      const c = map.getCenter();
      setArea((prev) => (prev && boundsContain(prev, c.lat, c.lng) ? prev : boundsAround(c.lat, c.lng, 30)));
    };
    update();
    map.on('moveend', update);
    return () => {
      map.off('moveend', update);
    };
  }, [available, map]);

  useEffect(() => {
    if (available && !area && fix) setArea(boundsAround(fix.coordinates.lat, fix.coordinates.lng, 30));
  }, [available, area, fix]);

  useEffect(() => {
    if (!available || !area) return;
    const controller = new AbortController();
    setLoading(true);
    fetchCommunityPlaces(area, controller.signal)
      .then((p) => {
        setPlaces(p);
        setError(null);
      })
      .catch((err: unknown) => !controller.signal.aborted && setError(err instanceof Error ? err.message : 'Could not load places'))
      .finally(() => !controller.signal.aborted && setLoading(false));
    return () => controller.abort();
  }, [available, area]);

  const idsKey = places.map((p) => p.id).join(',');
  useEffect(() => {
    if (!user || !idsKey) {
      setRecommended(new Set());
      return;
    }
    void fetchMyRecommendations(idsKey.split(','), user.id).then(setRecommended);
  }, [user, idsKey]);

  const requireUser = useCallback(() => {
    if (!available) throw new Error('Community features are not connected yet.');
    if (!user) throw new Error('Sign in to share and recommend places.');
    return user;
  }, [available, user]);

  const add = useCallback(
    async (p: NewCommunityPlace) => {
      const u = requireUser();
      const created = await createCommunityPlace(p, u.id);
      setPlaces((prev) => [created, ...prev]);
      return created;
    },
    [requireUser],
  );

  const toggleRecommend = useCallback(
    async (id: string) => {
      const u = requireUser();
      const on = !recommended.has(id);
      await setRecommendation(id, u.id, on);
      setRecommended((prev) => {
        const next = new Set(prev);
        if (on) next.add(id);
        else next.delete(id);
        return next;
      });
      setPlaces((prev) => prev.map((p) => (p.id === id ? { ...p, recommend_count: Math.max(0, p.recommend_count + (on ? 1 : -1)) } : p)));
    },
    [requireUser, recommended],
  );

  const remove = useCallback(
    async (id: string) => {
      requireUser();
      await deleteCommunityPlace(id);
      setPlaces((prev) => prev.filter((p) => p.id !== id));
    },
    [requireUser],
  );

  const value = useMemo<CommunityPlacesValue>(
    () => ({ available, places, loading, error, recommended, add, toggleRecommend, remove, findById: (id) => places.find((p) => p.id === id) }),
    [available, places, loading, error, recommended, add, toggleRecommend, remove],
  );
  return <CommunityPlacesContext.Provider value={value}>{children}</CommunityPlacesContext.Provider>;
}

export function useCommunityPlaces(): CommunityPlacesValue {
  const ctx = useContext(CommunityPlacesContext);
  if (!ctx) throw new Error('useCommunityPlaces must be used within CommunityPlacesProvider');
  return ctx;
}
