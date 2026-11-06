import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { features } from '@/lib/config';
import { speak, useVoiceAlerts, useVoiceLang, vibrate } from '@/hooks/useVoiceAlerts';
import {
  ConvoyError,
  createConvoy,
  fetchConvoy,
  joinConvoy,
  leaderUpdate,
  leaveConvoy,
  pushConvoyPosition,
  removeMember,
  subscribeToConvoy,
  type Convoy,
  type ConvoyMember,
} from '@/services/convoyService';
import type { Coordinates, Place } from '@/types';
import { ARRIVE_M, convoyEvents, eventPhrase, newAlertMemory } from '@/utils/convoy';
import { haversineMeters } from '@/utils/geo';
import { useAuth } from './AuthContext';
import { useLocation } from './LocationContext';
import { useRouting } from './RoutingContext';

export interface ConvoyPlace {
  name: string;
  coordinates: Coordinates;
}

interface ConvoyValue {
  available: boolean;
  convoy: Convoy | null;
  /** Active members (left / removed filtered out) */
  members: ConvoyMember[];
  me: ConvoyMember | null;
  isLeader: boolean;
  destination: ConvoyPlace | null;
  meetPoint: ConvoyPlace | null;
  live: boolean;
  /** Set when we were dropped from the convoy (ended / removed) */
  notice: string | null;
  dismissNotice: () => void;
  create: (opts: { name: string; displayName: string; destination?: ConvoyPlace | null }) => Promise<void>;
  join: (code: string, displayName: string) => Promise<void>;
  leave: () => Promise<void>;
  end: () => Promise<void>;
  setDestination: (p: ConvoyPlace | null) => Promise<void>;
  setMeetPoint: (p: ConvoyPlace | null) => Promise<void>;
  remove: (userId: string) => Promise<void>;
  navigateTo: (which: 'destination' | 'meet') => void;
}

const ConvoyContext = createContext<ConvoyValue | null>(null);
const KEY = 'jalango:convoy';
const MIN_INTERVAL_MS = 4_000;
const HEARTBEAT_MS = 20_000;
const MIN_MOVE_M = 15;

function readStored(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}
function store(id: string | null) {
  try {
    if (id) localStorage.setItem(KEY, id);
    else localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

function place(name: string | null, lat: number | null, lng: number | null): ConvoyPlace | null {
  return lat !== null && lng !== null ? { name: name || 'Pinned spot', coordinates: { lat, lng } } : null;
}

export function toRoutingPlace(p: ConvoyPlace, kind: 'destination' | 'meet'): Place {
  return {
    id: `convoy:${kind}:${p.coordinates.lat.toFixed(5)},${p.coordinates.lng.toFixed(5)}`,
    name: p.name,
    address: kind === 'meet' ? 'Titik berkumpul konvoi' : 'Destinasi konvoi',
    coordinates: p.coordinates,
    kind: 'poi',
    source: 'mapbox',
  };
}

/**
 * Konvoi (group travel): the active convoy, its members' live positions,
 * the publisher for our own position, and voice alerts for the group.
 */
export function ConvoyProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { fix } = useLocation();
  const { status, destination: routeDest, progress, planRoute } = useRouting();
  const [voiceOn] = useVoiceAlerts();
  const [lang] = useVoiceLang();
  const available = features.supabase && Boolean(user);
  const [convoyId, setConvoyId] = useState<string | null>(() => readStored());
  const [convoy, setConvoy] = useState<Convoy | null>(null);
  const [allMembers, setAllMembers] = useState<ConvoyMember[]>([]);
  const [live, setLive] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const lastPush = useRef<{ t: number; lat: number; lng: number; arrived: boolean } | null>(null);
  const memory = useRef(newAlertMemory());
  const lastMeet = useRef<string | null>(null);

  const drop = useCallback((message: string | null) => {
    store(null);
    setConvoyId(null);
    setConvoy(null);
    setAllMembers([]);
    setNotice(message);
    memory.current = newAlertMemory();
    lastMeet.current = null;
    lastPush.current = null;
  }, []);

  // Load + keep fresh (realtime nudges a refetch; polling is the fallback)
  useEffect(() => {
    if (!available || !convoyId) {
      if (!available) {
        setConvoy(null);
        setAllMembers([]);
      }
      return;
    }
    let cancelled = false;
    fetchConvoy(convoyId)
      .then(({ convoy: c, members }) => {
        if (cancelled) return;
        const mine = members.find((m) => m.user_id === user?.id);
        if (!c || c.ended_at || Date.parse(c.expires_at) <= Date.now()) return drop(c ? 'Konvoi telah tamat. / The convoy has ended.' : null);
        if (!mine || mine.left_at) return drop(mine?.removed ? 'Ketua konvoi telah mengeluarkan anda. / The leader removed you from the convoy.' : null);
        setConvoy(c);
        setAllMembers(members);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [available, convoyId, nonce, user?.id, drop]);

  useEffect(() => {
    if (!available || !convoyId) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const bump = () => {
      // coalesce bursts of row updates into one refetch
      if (timer) return;
      timer = setTimeout(() => {
        timer = null;
        setNonce((n) => n + 1);
      }, 800);
    };
    const unsub = subscribeToConvoy(convoyId, bump, setLive);
    return () => {
      if (timer) clearTimeout(timer);
      unsub();
      setLive(false);
    };
  }, [available, convoyId]);

  useEffect(() => {
    if (!available || !convoyId) return;
    const id = setInterval(() => setNonce((n) => n + 1), live ? 30_000 : 8_000);
    return () => clearInterval(id);
  }, [available, convoyId, live]);

  const members = useMemo(() => allMembers.filter((m) => !m.left_at), [allMembers]);
  const me = members.find((m) => m.user_id === user?.id) ?? null;
  const isLeader = Boolean(convoy && user && convoy.leader_id === user.id);
  const destination = useMemo(
    () => (convoy ? place(convoy.destination_name, convoy.dest_latitude, convoy.dest_longitude) : null),
    [convoy?.destination_name, convoy?.dest_latitude, convoy?.dest_longitude], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const meetPoint = useMemo(
    () => (convoy ? place(convoy.meet_name, convoy.meet_latitude, convoy.meet_longitude) : null),
    [convoy?.meet_name, convoy?.meet_latitude, convoy?.meet_longitude], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Publish our position (throttled; latest position only)
  useEffect(() => {
    if (!fix || !convoy || !me || !user) return;
    const now = Date.now();
    const prev = lastPush.current;
    const dist = destination ? haversineMeters(fix.coordinates, destination.coordinates) : null;
    const arrived = dist !== null && dist <= ARRIVE_M;
    const arrivedChanged = Boolean(me.arrived_at) !== arrived && (arrived || !me.arrived_at);
    const moved = prev ? haversineMeters({ lat: prev.lat, lng: prev.lng }, fix.coordinates) : Infinity;
    if (prev && !arrivedChanged && (now - prev.t < MIN_INTERVAL_MS || (moved < MIN_MOVE_M && now - prev.t < HEARTBEAT_MS))) return;
    lastPush.current = { t: now, lat: fix.coordinates.lat, lng: fix.coordinates.lng, arrived };
    const routingToConvoy =
      status === 'navigating' && progress && routeDest && destination && haversineMeters(routeDest.coordinates, destination.coordinates) < 300;
    const etaAt = routingToConvoy ? new Date(now + progress.remainingSeconds * 1000).toISOString() : null;
    pushConvoyPosition(convoy.id, user.id, fix, { etaAt, arrived: arrived ? (me.arrived_at ? null : true) : null }).catch((err) => {
      if (err instanceof ConvoyError && err.code === 'inactive') setNonce((n) => n + 1);
      else lastPush.current = prev;
    });
  }, [fix, convoy, me, user, destination, status, progress, routeDest]);

  // Voice alerts for the group
  useEffect(() => {
    if (!convoy || !user || members.length === 0) return;
    const events = convoyEvents(members, { meId: user.id, leaderId: convoy.leader_id, destination: destination?.coordinates ?? null }, memory.current);
    if (events.length && voiceOn) {
      vibrate([120, 80, 120]);
      for (const e of events) speak(eventPhrase(e, lang), lang);
    }
  }, [members, convoy, user, destination, voiceOn, lang]);

  // Announce a new meeting point
  useEffect(() => {
    const key = meetPoint ? `${meetPoint.name}@${meetPoint.coordinates.lat},${meetPoint.coordinates.lng}` : '';
    if (lastMeet.current === null) {
      lastMeet.current = key; // first load: don't announce what was already set
      return;
    }
    if (key && key !== lastMeet.current && voiceOn && !isLeader) {
      speak(lang === 'ms' ? `Titik berkumpul baharu: ${meetPoint!.name}.` : `New meeting point: ${meetPoint!.name}.`, lang);
    }
    lastMeet.current = key;
  }, [meetPoint, voiceOn, lang, isLeader]);

  const create = useCallback(async (opts: { name: string; displayName: string; destination?: ConvoyPlace | null }) => {
    const id = await createConvoy(opts);
    store(id);
    setNotice(null);
    memory.current = newAlertMemory();
    lastMeet.current = null;
    lastPush.current = null;
    setConvoyId(id);
    setNonce((n) => n + 1);
  }, []);

  const join = useCallback(async (code: string, displayName: string) => {
    const id = await joinConvoy(code, displayName);
    store(id);
    setNotice(null);
    memory.current = newAlertMemory();
    lastMeet.current = null;
    lastPush.current = null;
    setConvoyId(id);
    setNonce((n) => n + 1);
  }, []);

  const leave = useCallback(async () => {
    if (convoy && user) await leaveConvoy(convoy.id, user.id);
    drop(null);
  }, [convoy, user, drop]);

  const end = useCallback(async () => {
    if (convoy) await leaderUpdate(convoy.id, 'end');
    drop(null);
  }, [convoy, drop]);

  const setDestination = useCallback(async (p: ConvoyPlace | null) => {
    if (!convoy) return;
    await leaderUpdate(convoy.id, 'destination', p);
    setNonce((n) => n + 1);
  }, [convoy]);

  const setMeetPoint = useCallback(async (p: ConvoyPlace | null) => {
    if (!convoy) return;
    await leaderUpdate(convoy.id, 'meet', p);
    setNonce((n) => n + 1);
  }, [convoy]);

  const remove = useCallback(async (userId: string) => {
    if (!convoy) return;
    await removeMember(convoy.id, userId);
    setNonce((n) => n + 1);
  }, [convoy]);

  const navigateTo = useCallback(
    (which: 'destination' | 'meet') => {
      const p = which === 'meet' ? meetPoint : destination;
      if (p) planRoute(toRoutingPlace(p, which));
    },
    [meetPoint, destination, planRoute],
  );

  const value = useMemo<ConvoyValue>(
    () => ({
      available,
      convoy,
      members,
      me,
      isLeader,
      destination,
      meetPoint,
      live,
      notice,
      dismissNotice: () => setNotice(null),
      create,
      join,
      leave,
      end,
      setDestination,
      setMeetPoint,
      remove,
      navigateTo,
    }),
    [available, convoy, members, me, isLeader, destination, meetPoint, live, notice, create, join, leave, end, setDestination, setMeetPoint, remove, navigateTo],
  );
  return <ConvoyContext.Provider value={value}>{children}</ConvoyContext.Provider>;
}

export function useConvoy(): ConvoyValue {
  const ctx = useContext(ConvoyContext);
  if (!ctx) throw new Error('useConvoy must be used within ConvoyProvider');
  return ctx;
}
