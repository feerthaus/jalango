import type { RealtimeChannel } from '@supabase/supabase-js';
import { useEffect, useRef, useState } from 'react';
import { useLocation } from '@/contexts/LocationContext';
import { useRouting } from '@/contexts/RoutingContext';
import { supabase } from '@/lib/supabase';
import { cellOf, detectOncoming, neighbourCells, type DriverState, type OncomingThreat } from '@/utils/oncoming';
import { useOncomingSetting } from './useOncomingSetting';
import { speak, useVoiceAlerts, useVoiceLang, vibrate } from './useVoiceAlerts';

const PUBLISH_EVERY_MS = 2000;
const GLOBAL_COOLDOWN_MS = 12_000;
const PER_VEHICLE_COOLDOWN_MS = 45_000;
const SHOW_FOR_MS = 5000;

/**
 * EXPERIMENTAL. While navigating with the setting on, exchange anonymous,
 * ephemeral positions with nearby JalanGo drivers over Supabase Realtime
 * broadcast (nothing is stored) and warn — by voice — when another JalanGo
 * driver is coming towards us on the same undivided road.
 */
export function useOncomingAlerts(): OncomingThreat | null {
  const [enabled] = useOncomingSetting();
  const [voiceOn] = useVoiceAlerts();
  const [lang] = useVoiceLang();
  const { fix } = useLocation();
  const { status, selectedRoute, progress } = useRouting();
  const active = enabled && status === 'navigating' && Boolean(supabase);

  const tripId = useRef(crypto.randomUUID());
  const others = useRef(new Map<string, DriverState>());
  const channels = useRef(new Map<string, RealtimeChannel>());
  const lastPublish = useRef(0);
  const lastAlert = useRef(0);
  const alerted = useRef(new Map<string, number>());
  const [threat, setThreat] = useState<OncomingThreat | null>(null);

  const cellKey = fix ? cellOf(fix.coordinates.lat, fix.coordinates.lng).join(':') : null;

  // Join the 3×3 grid of channels around us (re-join when we change cell)
  useEffect(() => {
    if (!active || !cellKey || !supabase) return;
    const sb = supabase;
    const [x, y] = cellKey.split(':').map(Number) as [number, number];
    const wanted = new Set(neighbourCells([x, y]).map((c) => `jg-drive:${c}`));
    for (const [name, ch] of channels.current) {
      if (!wanted.has(name)) {
        void sb.removeChannel(ch);
        channels.current.delete(name);
      }
    }
    for (const name of wanted) {
      if (channels.current.has(name)) continue;
      const ch = sb
        .channel(name, { config: { broadcast: { self: false } } })
        .on('broadcast', { event: 'pos' }, ({ payload }) => {
          const p = payload as Partial<DriverState> & { id?: string };
          if (!p.id || p.id === tripId.current || typeof p.lat !== 'number' || typeof p.lng !== 'number') return;
          if (typeof p.heading !== 'number' || typeof p.speed !== 'number' || typeof p.t !== 'number') return;
          others.current.set(p.id, { lat: p.lat, lng: p.lng, heading: p.heading, speed: p.speed, t: Math.min(p.t, Date.now()) });
        })
        .subscribe();
      channels.current.set(name, ch);
    }
  }, [active, cellKey]);

  // Leave everything when inactive
  useEffect(() => {
    if (active) return;
    for (const ch of channels.current.values()) void supabase?.removeChannel(ch);
    channels.current.clear();
    others.current.clear();
    tripId.current = crypto.randomUUID();
    setThreat(null);
  }, [active]);

  // Publish + detect on each GPS fix
  useEffect(() => {
    if (!active || !fix || fix.heading === null || fix.speed === null || !cellKey) return;
    const now = Date.now();
    const me: DriverState = { lat: fix.coordinates.lat, lng: fix.coordinates.lng, heading: fix.heading, speed: fix.speed, t: now };

    if (now - lastPublish.current >= PUBLISH_EVERY_MS && fix.accuracy <= 30) {
      lastPublish.current = now;
      const own = channels.current.get(`jg-drive:${cellKey}`);
      void own?.send({
        type: 'broadcast',
        event: 'pos',
        payload: { id: tripId.current, lat: +me.lat.toFixed(6), lng: +me.lng.toFixed(6), heading: Math.round(me.heading), speed: +me.speed.toFixed(1), t: now },
      });
    }

    for (const [id, s] of others.current) if (now - s.t > 10_000) others.current.delete(id);

    // Never on motorways / divided highways
    const step = selectedRoute && progress ? selectedRoute.steps[progress.stepIndex] : undefined;
    if (step?.motorway) return;

    const t = detectOncoming(me, others.current, now);
    if (!t) return;
    const lastForThis = alerted.current.get(t.id) ?? 0;
    if (now - lastAlert.current < GLOBAL_COOLDOWN_MS || now - lastForThis < PER_VEHICLE_COOLDOWN_MS) return;
    lastAlert.current = now;
    alerted.current.set(t.id, now);
    setThreat(t);
    vibrate([250, 100, 250]);
    if (voiceOn) speak(lang === 'ms' ? 'Awas, kenderaan dari arah bertentangan. Jangan memotong.' : 'Caution, oncoming vehicle. Do not overtake.', lang, { interrupt: true });
  }, [active, fix, cellKey, selectedRoute, progress, voiceOn, lang]);

  useEffect(() => {
    if (!threat) return;
    const id = setTimeout(() => setThreat(null), SHOW_FOR_MS);
    return () => clearTimeout(id);
  }, [threat]);

  return threat;
}
