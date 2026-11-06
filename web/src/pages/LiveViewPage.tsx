import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Clock, Flag, Loader2, MapPinOff, Navigation, Radio } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import { LogoMark } from '@/components/brand/LogoMark';
import { CAR_SVG } from '@/components/map/UserLocationMarker';
import { useTheme } from '@/contexts/ThemeContext';
import { features } from '@/lib/config';
import { styleFor } from '@/lib/mapStyles';
import { getPublicShare, type PublicLiveShare } from '@/services/liveShareService';
import { formatRelativeTime } from '@/utils/format';
import { lerp, lerpAngle } from '@/utils/motion';
import { toKmh } from '@/utils/geo';

const POLL_MS = 5_000;

/** Public page behind a share link: someone's live position, smoothly animated. No sign-in needed. */
export function LiveViewPage() {
  const { token = '' } = useParams();
  const { theme } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const carRef = useRef<mapboxgl.Marker | null>(null);
  const destRef = useRef<mapboxgl.Marker | null>(null);
  const shown = useRef<{ lng: number; lat: number; bearing: number } | null>(null);
  const frame = useRef<number | null>(null);
  const [share, setShare] = useState<PublicLiveShare | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [follow, setFollow] = useState(true);
  const [, tick] = useState(0);

  // Poll the share
  useEffect(() => {
    let alive = true;
    const load = () =>
      getPublicShare(token)
        .then((s) => alive && (setShare(s), setError(null)))
        .catch((e: Error) => alive && setError(e.message));
    void load();
    const id = setInterval(load, POLL_MS);
    const clock = setInterval(() => tick((n) => n + 1), 1000);
    return () => {
      alive = false;
      clearInterval(id);
      clearInterval(clock);
    };
  }, [token]);

  // Map
  useEffect(() => {
    if (!containerRef.current) return;
    const map = new mapboxgl.Map({ container: containerRef.current, style: styleFor(theme, features.mapboxTiles), center: [101.6958, 3.1466], zoom: 11, attributionControl: false });
    map.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-right');
    map.on('dragstart', (e) => e.originalEvent && setFollow(false));
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
    // theme changes are rare here; initial theme is enough
  }, []);

  // Car + destination markers, animated between polls
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !share) return;
    if (share.dest_latitude !== null && share.dest_longitude !== null) {
      if (!destRef.current) {
        const el = document.createElement('div');
        el.innerHTML = `<svg width="30" height="38" viewBox="0 0 36 46"><path d="M18 45s15-15.2 15-27A15 15 0 0 0 3 18c0 11.8 15 27 15 27Z" fill="#ef4444" stroke="white" stroke-width="2.5"/><circle cx="18" cy="18" r="5.5" fill="white"/></svg>`;
        destRef.current = new mapboxgl.Marker({ element: el, anchor: 'bottom' });
      }
      destRef.current.setLngLat([share.dest_longitude, share.dest_latitude]).addTo(map);
    }
    if (share.latitude === null || share.longitude === null) {
      carRef.current?.remove();
      return;
    }
    if (!carRef.current) {
      const el = document.createElement('div');
      el.innerHTML = CAR_SVG;
      carRef.current = new mapboxgl.Marker({ element: el, rotationAlignment: 'map' });
    }
    const car = carRef.current;
    const target = { lng: share.longitude, lat: share.latitude, bearing: share.heading ?? shown.current?.bearing ?? 0 };
    const from = shown.current;
    if (!car.getElement().isConnected) car.setLngLat([target.lng, target.lat]).addTo(map);
    if (frame.current) cancelAnimationFrame(frame.current);
    if (!from) {
      shown.current = target;
      car.setLngLat([target.lng, target.lat]).setRotation(target.bearing);
      map.jumpTo({ center: [target.lng, target.lat], zoom: 15 });
      return;
    }
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / POLL_MS);
      const cur = { lng: lerp(from.lng, target.lng, t), lat: lerp(from.lat, target.lat, t), bearing: lerpAngle(from.bearing, target.bearing, Math.min(1, t * 2)) };
      shown.current = cur;
      car.setLngLat([cur.lng, cur.lat]).setRotation(cur.bearing);
      if (follow) map.setCenter([cur.lng, cur.lat]);
      if (t < 1) frame.current = requestAnimationFrame(step);
    };
    frame.current = requestAnimationFrame(step);
  }, [share, follow]);

  const live = share?.status === 'live';
  const etaMin = share?.eta_at ? Math.max(0, Math.round((Date.parse(share.eta_at) - Date.now()) / 60_000)) : null;
  const stale = share?.position_at ? Date.now() - Date.parse(share.position_at) > 2 * 60_000 : false;

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-ink-100 dark:bg-ink-950">
      {/* mapbox-gl.css sets .mapboxgl-map { position: relative }, so size the map from a wrapper */}
      <div className="absolute inset-0">
        <div ref={containerRef} className="h-full w-full" />
      </div>
      <header className="safe-top absolute inset-x-0 top-0 z-10 p-3">
        <div className="glass mx-auto flex max-w-md items-center gap-2 rounded-2xl p-2 pr-3 shadow-float">
          <LogoMark className="size-9" />
          <p className="flex-1 text-sm font-semibold">JalanGo live location</p>
          {live && (
            <span className="flex items-center gap-1 rounded-full bg-red-500 px-2 py-0.5 text-[11px] font-bold text-white">
              <Radio className="size-3 animate-pulse" /> LIVE
            </span>
          )}
        </div>
      </header>

      <div className="safe-bottom absolute inset-x-0 bottom-0 z-10 p-3">
        <div className="glass mx-auto max-w-md rounded-3xl p-4 shadow-float">
          {share === undefined ? (
            <Loader2 className="mx-auto size-6 animate-spin text-ink-400" />
          ) : share === null ? (
            <Ended icon={MapPinOff} title="Link not found" text="This live location link doesn’t exist or was removed." />
          ) : !live ? (
            <Ended icon={MapPinOff} title={`${share.display_name} stopped sharing`} text="Their location is no longer available." />
          ) : (
            <>
              <p className="text-lg font-bold">{share.display_name}</p>
              <p className="text-sm text-ink-500 dark:text-ink-300">
                {share.latitude === null ? 'Waiting for location…' : stale ? `Last seen ${formatRelativeTime(share.position_at!)}` : `Updated ${Math.max(0, Math.round((Date.now() - Date.parse(share.position_at!)) / 1000))} s ago`}
                {share.speed_mps !== null && share.speed_mps > 1 && !stale && ` · ${toKmh(share.speed_mps)} km/h`}
              </p>
              {share.destination_name && (
                <p className="mt-2 flex items-center gap-2 text-sm">
                  <Flag className="size-4 shrink-0 text-red-500" />
                  <span className="truncate">
                    Heading to <strong>{share.destination_name}</strong>
                    {etaMin !== null && ` · arriving in ~${etaMin} min`}
                  </span>
                </p>
              )}
              <p className="mt-2 flex items-center gap-1.5 text-xs text-ink-400">
                <Clock className="size-3.5" /> Sharing ends {new Date(share.expires_at).toLocaleTimeString('en-MY', { hour: 'numeric', minute: '2-digit' })}
              </p>
              {!follow && (
                <button type="button" onClick={() => setFollow(true)} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-ink-100 py-2 text-sm font-semibold dark:bg-ink-800">
                  <Navigation className="size-4" /> Follow {share.display_name}
                </button>
              )}
            </>
          )}
          {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
          <Link to="/" className="mt-3 block text-center text-xs font-semibold text-jade-700 dark:text-jade-400">
            Get JalanGo — free navigation for Malaysia
          </Link>
        </div>
      </div>
    </div>
  );
}

function Ended({ icon: Icon, title, text }: { icon: typeof MapPinOff; title: string; text: string }) {
  return (
    <div className="text-center">
      <Icon className="mx-auto mb-2 size-8 text-ink-400" />
      <p className="font-semibold">{title}</p>
      <p className="text-sm text-ink-500">{text}</p>
    </div>
  );
}
