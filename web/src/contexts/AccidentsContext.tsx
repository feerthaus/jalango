import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { features } from '@/lib/config';
import {
  createAccidentRecord,
  deleteAccidentRecord,
  fetchAccidentRecords,
  fetchMyAccidentVotes,
  preparePhoto,
  uploadAccidentPhoto,
  voteAccidentRecord,
  type NewAccidentRecord,
} from '@/services/accidentService';
import type { Bounds } from '@/services/reportsService';
import type { AccidentRecord } from '@/types';
import { clusterAccidents, type Hotspot } from '@/utils/accidentHotspots';
import { boundsAround, boundsContain } from '@/utils/bounds';
import { useAuth } from './AuthContext';
import { useLocation } from './LocationContext';
import { useMapContext } from './MapContext';

interface AccidentsValue {
  available: boolean;
  records: AccidentRecord[];
  hotspots: Hotspot[];
  myVotes: Record<string, 1 | -1>;
  selected: Hotspot | null;
  select: (h: Hotspot | null) => void;
  add: (r: Omit<NewAccidentRecord, 'photoPath'>, photo?: File | null) => Promise<AccidentRecord>;
  vote: (id: string, v: 1 | -1) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

const AccidentsContext = createContext<AccidentsValue | null>(null);

/** Accident history around the map / driver, grouped into spots. */
export function AccidentsProvider({ children }: { children: ReactNode }) {
  const available = features.supabase;
  const { user } = useAuth();
  const { map, selectedPlace } = useMapContext();
  const { fix } = useLocation();
  const [records, setRecords] = useState<AccidentRecord[]>([]);
  const [area, setArea] = useState<Bounds | null>(null);
  const [myVotes, setMyVotes] = useState<Record<string, 1 | -1>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);

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
    fetchAccidentRecords(area, controller.signal).then(setRecords, () => {});
    return () => controller.abort();
  }, [available, area]);

  const hotspots = useMemo(() => clusterAccidents(records), [records]);
  const selected = useMemo(() => {
    if (!selectedId) return null;
    // a spot's id can change as records are added: fall back to the spot holding any of its old records
    return hotspots.find((h) => h.id === selectedId || h.records.some((r) => `spot:${r.id}` === selectedId)) ?? null;
  }, [hotspots, selectedId]);

  const idsKey = records.map((r) => r.id).join(',');
  useEffect(() => {
    if (!user || !idsKey) return setMyVotes({});
    void fetchMyAccidentVotes(idsKey.split(','), user.id).then(setMyVotes);
  }, [user, idsKey]);

  useEffect(() => {
    if (selectedPlace) setSelectedId(null);
  }, [selectedPlace]);

  const requireUser = useCallback(() => {
    if (!available) throw new Error('Community features are not connected yet.');
    if (!user) throw new Error('Log masuk untuk menambah rekod.');
    return user;
  }, [available, user]);

  const add = useCallback(
    async (r: Omit<NewAccidentRecord, 'photoPath'>, photo?: File | null) => {
      const u = requireUser();
      const photoPath = photo ? await uploadAccidentPhoto(await preparePhoto(photo), u.id) : null;
      const created = await createAccidentRecord({ ...r, photoPath }, u.id);
      setRecords((prev) => [created, ...prev]);
      return created;
    },
    [requireUser],
  );

  const vote = useCallback(
    async (id: string, v: 1 | -1) => {
      const u = requireUser();
      const prev = myVotes[id];
      await voteAccidentRecord(id, u.id, v);
      setMyVotes((m) => ({ ...m, [id]: v }));
      setRecords((list) =>
        list.map((r) =>
          r.id === id ? { ...r, upvotes: r.upvotes + (v === 1 ? 1 : 0) - (prev === 1 ? 1 : 0), downvotes: r.downvotes + (v === -1 ? 1 : 0) - (prev === -1 ? 1 : 0) } : r,
        ),
      );
    },
    [requireUser, myVotes],
  );

  const remove = useCallback(
    async (id: string) => {
      requireUser();
      await deleteAccidentRecord(id);
      setRecords((list) => list.filter((r) => r.id !== id));
    },
    [requireUser],
  );

  const select = useCallback((h: Hotspot | null) => setSelectedId(h?.id ?? null), []);

  const value = useMemo(
    () => ({ available, records, hotspots, myVotes, selected, select, add, vote, remove }),
    [available, records, hotspots, myVotes, selected, select, add, vote, remove],
  );
  return <AccidentsContext.Provider value={value}>{children}</AccidentsContext.Provider>;
}

export function useAccidents(): AccidentsValue {
  const ctx = useContext(AccidentsContext);
  if (!ctx) throw new Error('useAccidents must be used inside AccidentsProvider');
  return ctx;
}
