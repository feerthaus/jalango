import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { features } from '@/lib/config';
import {
  deleteReport,
  fetchActiveReports,
  fetchMyVotes,
  isVisible,
  ReportError,
  submitReport,
  subscribeToReports,
  voteOnReport,
  type Bounds,
} from '@/services/reportsService';
import type { ConfirmationType, NewReport, TrafficReport } from '@/types';
import { useAuth } from './AuthContext';
import { useLocation } from './LocationContext';
import { useMapContext } from './MapContext';

interface ReportsValue {
  available: boolean;
  reports: TrafficReport[];
  loading: boolean;
  error: string | null;
  /** Realtime channel connected */
  live: boolean;
  myVotes: Record<string, ConfirmationType>;
  selectedReport: TrafficReport | null;
  selectReport: (r: TrafficReport | null) => void;
  submit: (r: NewReport) => Promise<TrafficReport>;
  vote: (reportId: string, type: ConfirmationType) => Promise<void>;
  remove: (reportId: string) => Promise<void>;
  refresh: () => void;
}

const ReportsContext = createContext<ReportsValue | null>(null);

/** ~25 km box around a point; generous so panning a little doesn't refetch. */
function boundsAround(lat: number, lng: number, km = 25): Bounds {
  const dLat = km / 111;
  const dLng = km / (111 * Math.cos((lat * Math.PI) / 180));
  return { minLat: lat - dLat, maxLat: lat + dLat, minLng: lng - dLng, maxLng: lng + dLng };
}

const contains = (b: Bounds, lat: number, lng: number) => lat >= b.minLat && lat <= b.maxLat && lng >= b.minLng && lng <= b.maxLng;

export function ReportsProvider({ children }: { children: ReactNode }) {
  const available = features.supabase;
  const { user } = useAuth();
  const { map, flyTo, clearSelection, selectedPlace } = useMapContext();
  const { fix } = useLocation();

  const [byId, setById] = useState<Record<string, TrafficReport>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  const [myVotes, setMyVotes] = useState<Record<string, ConfirmationType>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [area, setArea] = useState<Bounds | null>(null);
  const [nonce, setNonce] = useState(0);
  const lastSubmit = useRef(0);

  // Decide which area to load: around the map centre, re-centred when the view leaves it
  useEffect(() => {
    if (!available || !map) return;
    const update = () => {
      const c = map.getCenter();
      setArea((prev) => (prev && contains(prev, c.lat, c.lng) && map.getZoom() > 7 ? prev : boundsAround(c.lat, c.lng)));
    };
    update();
    map.on('moveend', update);
    return () => {
      map.off('moveend', update);
    };
  }, [available, map]);

  // Load reports for the area
  useEffect(() => {
    if (!available || !area) return;
    const controller = new AbortController();
    setLoading(true);
    fetchActiveReports(area, controller.signal)
      .then((list) => {
        setById(Object.fromEntries(list.map((r) => [r.id, r])));
        setError(null);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : 'Could not load reports');
      })
      .finally(() => !controller.signal.aborted && setLoading(false));
    return () => controller.abort();
  }, [available, area, nonce]);

  // Realtime updates
  useEffect(() => {
    if (!available) return;
    return subscribeToReports((change) => {
      setById((prev) => {
        if (change.kind === 'delete') {
          if (!(change.id in prev)) return prev;
          const next = { ...prev };
          delete next[change.id];
          return next;
        }
        return { ...prev, [change.report.id]: change.report };
      });
    }, setLive);
  }, [available]);

  // Drop reports as they expire
  useEffect(() => {
    if (!available) return;
    const id = setInterval(() => setById((prev) => ({ ...prev })), 60_000);
    return () => clearInterval(id);
  }, [available]);

  const reports = useMemo(() => {
    const now = Date.now();
    return Object.values(byId).filter((r) => isVisible(r, now) && (!area || contains(area, r.latitude, r.longitude)));
  }, [byId, area]);

  // The signed-in user's votes on visible reports
  const reportIdsKey = reports.map((r) => r.id).sort().join(',');
  useEffect(() => {
    if (!user || !reportIdsKey) {
      setMyVotes({});
      return;
    }
    fetchMyVotes(reportIdsKey.split(','), user.id)
      .then(setMyVotes)
      .catch(() => {
        /* non-critical */
      });
  }, [user, reportIdsKey]);

  const requireUser = useCallback(() => {
    if (!available) throw new ReportError('Community reports are not connected yet.', 'not_configured');
    if (!user) throw new ReportError('Sign in to report and vote.', 'auth');
    return user;
  }, [available, user]);

  const submit = useCallback(
    async (r: NewReport) => {
      const u = requireUser();
      // light client-side cooldown on top of the database rate limit
      if (Date.now() - lastSubmit.current < 15_000) throw new ReportError('Please wait a few seconds before reporting again.', 'rate_limited');
      const created = await submitReport(r, u.id);
      lastSubmit.current = Date.now();
      setById((prev) => ({ ...prev, [created.id]: created }));
      return created;
    },
    [requireUser],
  );

  const vote = useCallback(
    async (reportId: string, type: ConfirmationType) => {
      const u = requireUser();
      await voteOnReport(reportId, u.id, type);
      setMyVotes((prev) => ({ ...prev, [reportId]: type }));
      setNonce((n) => n + 1); // pick up new counts/status even if realtime is down
    },
    [requireUser],
  );

  const remove = useCallback(
    async (reportId: string) => {
      requireUser();
      await deleteReport(reportId);
      setById((prev) => {
        const next = { ...prev };
        delete next[reportId];
        return next;
      });
      setSelectedId((id) => (id === reportId ? null : id));
    },
    [requireUser],
  );

  const selectReport = useCallback(
    (r: TrafficReport | null) => {
      setSelectedId(r?.id ?? null);
      if (r) {
        clearSelection();
        flyTo({ lat: r.latitude, lng: r.longitude }, 15);
      }
    },
    [clearSelection, flyTo],
  );

  // If the map hasn't loaded an area yet but we have GPS, start there
  useEffect(() => {
    if (available && !area && fix) setArea(boundsAround(fix.coordinates.lat, fix.coordinates.lng));
  }, [available, area, fix]);

  // Picking a place closes the report card
  useEffect(() => {
    if (selectedPlace) setSelectedId(null);
  }, [selectedPlace]);

  const selectedReport = selectedId ? (byId[selectedId] ?? null) : null;

  const value = useMemo<ReportsValue>(
    () => ({
      available,
      reports,
      loading,
      error,
      live,
      myVotes,
      selectedReport,
      selectReport,
      submit,
      vote,
      remove,
      refresh: () => setNonce((n) => n + 1),
    }),
    [available, reports, loading, error, live, myVotes, selectedReport, selectReport, submit, vote, remove],
  );
  return <ReportsContext.Provider value={value}>{children}</ReportsContext.Provider>;
}

export function useReports(): ReportsValue {
  const ctx = useContext(ReportsContext);
  if (!ctx) throw new Error('useReports must be used within ReportsProvider');
  return ctx;
}
