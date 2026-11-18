import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Bell, BellOff, CheckCircle2, Clock, Flag, TrafficCone, ListOrdered, Loader2, LocateFixed, MapPinOff, MessageCircle, Navigation, Phone, Radio, VolumeX, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { arm, chime, disarm, ring, stopRinging } from '@/lib/arrivalAlarm';
import { hasArrived } from '@/utils/arrival';
import type { Coordinates } from '@/types';
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
import { useT } from '@/lib/i18n';

const POLL_MS = 5_000;

/** Public page behind a share link: someone's live position, smoothly animated. No sign-in needed. */
export function LiveViewPage() {
  const [t, lang] = useT();
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
  const alert = useArrivalAlert(share);
  const traffic = useTrafficAlert(share, alert.armed, alert.arrived);

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
      const k = Math.min(1, (now - start) / POLL_MS);
      const cur = { lng: lerp(from.lng, target.lng, k), lat: lerp(from.lat, target.lat, k), bearing: lerpAngle(from.bearing, target.bearing, Math.min(1, k * 2)) };
      shown.current = cur;
      car.setLngLat([cur.lng, cur.lat]).setRotation(cur.bearing);
      if (follow) map.setCenter([cur.lng, cur.lat]);
      if (k < 1) frame.current = requestAnimationFrame(step);
    };
    frame.current = requestAnimationFrame(step);
  }, [share, follow]);

  const live = share?.status === 'live';
  const etaMin = share?.eta_at ? Math.max(0, Math.round((Date.parse(share.eta_at) - Date.now()) / 60_000)) : null;
  const lateMin = share?.eta_delay_s ? Math.round(share.eta_delay_s / 60) : 0;
  const stale = share?.position_at ? Date.now() - Date.parse(share.position_at) > 2 * 60_000 : false;

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-ink-100 dark:bg-ink-950">
      {alert.arrived && share && <ArrivedBanner name={share.display_name} where={alert.targetLabel} ringing={alert.ringing} onStop={alert.stopSound} onClose={alert.dismiss} />}
      {/* mapbox-gl.css sets .mapboxgl-map { position: relative }, so size the map from a wrapper */}
      <div className="absolute inset-0">
        <div ref={containerRef} className="h-full w-full" />
      </div>
      <header className="safe-top absolute inset-x-0 top-0 z-10 p-3">
        <div className="glass mx-auto flex max-w-md items-center gap-2 rounded-2xl p-2 pr-3 shadow-float">
          <LogoMark className="size-9" />
          <p className="flex-1 text-sm font-semibold">{t('Lokasi live JalanGo', 'JalanGo live location')}</p>
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
            <Ended icon={MapPinOff} title={t('Pautan tidak dijumpai', 'Link not found')} text={t('Pautan lokasi live ini tidak wujud atau telah dibuang.', 'This live location link doesn’t exist or was removed.')} />
          ) : !live ? (
            <Ended icon={MapPinOff} title={t(`${share.display_name} berhenti berkongsi`, `${share.display_name} stopped sharing`)} text={t('Lokasi mereka tidak lagi tersedia.', 'Their location is no longer available.')} />
          ) : (
            <>
              {share.driver_plate || share.driver_vehicle ? (
                <DriverCard share={share} />
              ) : (
                <p className="text-lg font-bold">{share.display_name}</p>
              )}
              <p className="text-sm text-ink-500 dark:text-ink-300">
                {share.latitude === null ? t('Menunggu lokasi…', 'Waiting for location…') : stale ? t(`Kali terakhir dilihat ${formatRelativeTime(share.position_at!, lang)}`, `Last seen ${formatRelativeTime(share.position_at!, lang)}`) : t(`Dikemas kini ${Math.max(0, Math.round((Date.now() - Date.parse(share.position_at!)) / 1000))} saat lalu`, `Updated ${Math.max(0, Math.round((Date.now() - Date.parse(share.position_at!)) / 1000))} s ago`)}
                {share.speed_mps !== null && share.speed_mps > 1 && !stale && ` · ${toKmh(share.speed_mps)} km/h`}
              </p>
              {share.destination_name && (
                <p className="mt-2 flex items-center gap-2 text-sm">
                  <Flag className="size-4 shrink-0 text-red-500" />
                  <span className="truncate">
                    {t('Menuju ke', 'Heading to')} <strong>{share.destination_name}</strong>
                  </span>
                </p>
              )}
              {share.eta_at && etaMin !== null && !stale && (
                <p className="mt-1 flex flex-wrap items-center gap-x-2 text-sm">
                  <Clock className="size-4 shrink-0 text-ink-400" />
                  <span>
                    {t('Anggaran sampai', 'Expected at')} <strong>{clockOf(share.eta_at)}</strong> <span className="text-ink-500">({t(`~${etaMin} min lagi`, `~${etaMin} min`)})</span>
                  </span>
                  {lateMin >= 3 && <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:text-amber-200">{t(`lewat ~${lateMin} min`, `~${lateMin} min late`)}</span>}
                </p>
              )}
              {traffic.slowSince && <TrafficBanner name={share.display_name} since={traffic.slowSince} lateMin={lateMin} />}
              <ArrivalAlertControls share={share} alert={alert} />
              {share.next_stop_name && (
                <p className="mt-2 flex items-center gap-2 rounded-xl bg-violet-500/10 px-3 py-2 text-sm">
                  <ListOrdered className="size-4 shrink-0 text-violet-600" />
                  <span className="min-w-0 flex-1 truncate">
                    {t('Hentian seterusnya:', 'Next stop:')} <strong>{share.next_stop_name}</strong>
                  </span>
                  {typeof share.stops_left === 'number' && share.stops_left > 1 && <span className="shrink-0 text-xs text-ink-500">{share.stops_left} {t('lagi', 'left')}</span>}
                </p>
              )}
              <p className="mt-2 flex items-center gap-1.5 text-xs text-ink-400">
                <Clock className="size-3.5" /> {t('Perkongsian tamat', 'Sharing ends')} {new Date(share.expires_at).toLocaleTimeString('en-MY', { hour: 'numeric', minute: '2-digit' })}
              </p>
              {!follow && (
                <button type="button" onClick={() => setFollow(true)} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-ink-100 py-2 text-sm font-semibold dark:bg-ink-800">
                  <Navigation className="size-4" /> {t('Ikut', 'Follow')} {share.display_name}
                </button>
              )}
            </>
          )}
          {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
          <Link to="/" className="mt-3 block text-center text-xs font-semibold text-jade-700 dark:text-jade-400">
            {t('Dapatkan JalanGo — navigasi percuma untuk Malaysia', 'Get JalanGo — free navigation for Malaysia')}
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

/** Who is coming: name, vehicle, a big plate number to spot the car, and ways to reach the driver. */
function DriverCard({ share }: { share: PublicLiveShare }) {
  const [t] = useT();
  const phone = share.driver_phone;
  return (
    <div className="mb-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">{t('Pemandu anda', 'Your driver')}</p>
      <div className="mt-1 flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-bold">{share.display_name}</p>
          {share.driver_vehicle && <p className="truncate text-sm text-ink-500 dark:text-ink-300">{share.driver_vehicle}</p>}
        </div>
        {share.driver_plate && (
          <span className="shrink-0 rounded-lg border-2 border-ink-900 bg-ink-950 px-3 py-1.5 font-mono text-lg font-black tracking-wider text-white dark:border-white" aria-label={t(`Nombor plat ${share.driver_plate}`, `Plate number ${share.driver_plate}`)}>
            {share.driver_plate}
          </span>
        )}
      </div>
      {phone && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <a href={`https://wa.me/${phone}`} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-1.5 rounded-xl bg-[#25D366] py-2.5 text-sm font-semibold text-white">
            <MessageCircle className="size-4" /> WhatsApp
          </a>
          <a href={`tel:+${phone}`} className="flex items-center justify-center gap-1.5 rounded-xl bg-ink-100 py-2.5 text-sm font-semibold dark:bg-ink-800">
            <Phone className="size-4" /> {t('Telefon', 'Call')}
          </a>
        </div>
      )}
    </div>
  );
}

interface ArrivalAlert {
  armed: boolean;
  arrived: boolean;
  ringing: boolean;
  /** "lokasi anda" or the destination name */
  targetLabel: string;
  useMine: boolean;
  mineError: string | null;
  noTarget: boolean;
  noWakeLock: boolean;
  start: () => Promise<void>;
  stop: () => void;
  setUseMine: (on: boolean) => void;
  stopSound: () => void;
  dismiss: () => void;
}

/**
 * "Beritahu saya bila sampai": watches the polled share and rings once when the
 * driver reaches the target (the driver's destination, or the waiter's own spot
 * when they choose it; that position never leaves this phone).
 */
function useArrivalAlert(share: PublicLiveShare | null | undefined): ArrivalAlert {
  const [t] = useT();
  const [armed, setArmed] = useState(false);
  const [arrived, setArrived] = useState(false);
  // Closing the banner hides it; arrival stays recorded so the next poll doesn't ring again
  const [hidden, setHidden] = useState(false);
  const [ringing, setRinging] = useState(false);
  const [noWakeLock, setNoWakeLock] = useState(false);
  const [useMine, setUseMineState] = useState(false);
  const [mine, setMine] = useState<Coordinates | null>(null);
  const [mineError, setMineError] = useState<string | null>(null);
  const prevStatus = useRef<PublicLiveShare['status'] | null>(null);
  const baseTitle = useRef(document.title);

  const dest = share && share.dest_latitude !== null && share.dest_longitude !== null ? { lat: share.dest_latitude, lng: share.dest_longitude } : null;
  const target = useMine ? mine : dest;

  // The waiter's own position, only while they asked for it
  useEffect(() => {
    if (!useMine || !navigator.geolocation) return;
    setMineError(null);
    const id = navigator.geolocation.watchPosition(
      (p) => setMine({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => setMineError(t('Lokasi anda tidak dapat dibaca. Benarkan lokasi untuk pelayar ini.', 'Your location could not be read. Allow location for this browser.')),
      { enableHighAccuracy: true, maximumAge: 15_000, timeout: 20_000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [useMine]);

  // Check on every poll
  useEffect(() => {
    if (!share) return;
    const was = prevStatus.current;
    prevStatus.current = share.status;
    if (arrived) return;
    const position = share.latitude !== null && share.longitude !== null ? { lat: share.latitude, lng: share.longitude } : null;
    if (!hasArrived({ status: share.status, position, target, previousStatus: was })) return;
    setArrived(true);
    document.title = t(`🟢 ${share.display_name} dah sampai!`, `🟢 ${share.display_name} has arrived!`);
    if (armed) {
      ring();
      setRinging(true);
      window.setTimeout(() => setRinging(false), 30_000);
    }
  }, [share, target, armed, arrived]);

  // Leaving the page: stop everything, give the title back
  useEffect(() => {
    const title = baseTitle.current;
    return () => {
      disarm();
      document.title = title;
    };
  }, []);

  const start = useCallback(async () => {
    const r = await arm();
    setNoWakeLock(!r.wakeLock);
    setArmed(true);
  }, []);
  const stop = useCallback(() => {
    disarm();
    setArmed(false);
    setRinging(false);
  }, []);
  const stopSound = useCallback(() => {
    stopRinging();
    setRinging(false);
  }, []);
  const dismiss = useCallback(() => {
    stopRinging();
    setRinging(false);
    setHidden(true);
    disarm();
    setArmed(false);
    document.title = baseTitle.current;
  }, []);
  const setUseMine = useCallback((on: boolean) => {
    setUseMineState(on);
    if (!on) setMine(null);
  }, []);

  return {
    armed,
    arrived: arrived && !hidden,
    ringing,
    targetLabel: useMine ? t('lokasi anda', 'your location') : share?.destination_name ?? t('destinasi', 'the destination'),
    useMine,
    mineError,
    noTarget: !useMine && !dest,
    noWakeLock,
    start,
    stop,
    setUseMine,
    stopSound,
    dismiss,
  };
}

function clockOf(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-MY', { hour: 'numeric', minute: '2-digit' });
}

/**
 * The driver is stuck in traffic (their app says so after 2 minutes under 15 km/h).
 * One chime when it starts, if the alert is on; the tab title says so too.
 */
function useTrafficAlert(share: PublicLiveShare | null | undefined, armed: boolean, arrived: boolean): { slowSince: string | null } {
  const [t] = useT();
  const live = share?.status === 'live';
  const slowSince = live && !arrived ? share?.slow_since ?? null : null;
  const prev = useRef<string | null>(null);
  const baseTitle = useRef(document.title);
  useEffect(() => {
    const was = prev.current;
    prev.current = slowSince;
    if (slowSince && !was) {
      if (armed) chime();
      document.title = t(`🟡 ${share?.display_name ?? ''} dalam kesesakan`, `🟡 ${share?.display_name ?? ''} is in traffic`);
    } else if (!slowSince && was && !arrived) {
      document.title = baseTitle.current;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slowSince, armed, arrived]);
  return { slowSince };
}

function TrafficBanner({ name, since, lateMin }: { name: string; since: string; lateMin: number }) {
  const [t] = useT();
  return (
    <div role="status" className="mt-2 flex items-start gap-2 rounded-xl bg-amber-400/15 px-3 py-2 text-sm text-amber-900 dark:text-amber-100">
      <TrafficCone className="mt-0.5 size-4 shrink-0" />
      <span>
        <strong>{t(`${name} dalam kesesakan lalu lintas`, `${name} is in slow traffic`)}</strong> {t(`sejak ${clockOf(since)}`, `since ${clockOf(since)}`)}
        {lateMin >= 3 ? t(` · mungkin lewat ~${lateMin} min`, ` · may be ~${lateMin} min late`) : t(' · mungkin lewat sedikit', ' · may be a little late')}
      </span>
    </div>
  );
}

/** The "Beritahu saya bila sampai" button and, once on, what it is measuring to. */
function ArrivalAlertControls({ share, alert }: { share: PublicLiveShare; alert: ArrivalAlert }) {
  const [t] = useT();
  if (!alert.armed) {
    return (
      <div className="mt-3">
        <button type="button" onClick={() => void alert.start()} className="flex w-full items-center justify-center gap-2 rounded-xl bg-jade-500 py-3 text-sm font-bold text-ink-950">
          <Bell className="size-4" /> {t('Beritahu saya bila sampai', 'Tell me when they arrive')}
        </button>
        <p className="mt-1 text-center text-[11px] text-ink-500">{t('Bunyi bip bila', 'Beeps when')} {share.display_name} {t('sampai, dan bunyi pendek jika tersekat dalam kesesakan. Biarkan halaman ini terbuka.', 'arrives, and a short chime if stuck in traffic. Keep this page open.')}</p>
      </div>
    );
  }
  return (
    <div className="mt-3 rounded-xl bg-jade-500/10 p-3 text-sm">
      <div className="flex items-center gap-2">
        <Bell className="size-4 shrink-0 animate-pulse text-jade-600" />
        <p className="min-w-0 flex-1 font-semibold">
          {t('Amaran aktif ·', 'Alert on ·')} <span className="font-normal">{t('bila sampai di', 'on arrival at')} {alert.targetLabel}</span>
        </p>
        <button type="button" onClick={alert.stop} className="flex shrink-0 items-center gap-1 text-xs font-semibold text-ink-500" aria-label={t('Matikan amaran', 'Turn off alert')}>
          <BellOff className="size-3.5" /> {t('Matikan', 'Turn off')}
        </button>
      </div>
      {alert.noTarget && <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">{share.display_name} {t('tiada destinasi. Tekan “Beritahu bila dekat dengan saya”.', 'has no destination. Tap “Tell me when they’re near me”.')}</p>}
      <button type="button" onClick={() => alert.setUseMine(!alert.useMine)} className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-jade-700 dark:text-jade-300">
        <LocateFixed className="size-3.5" /> {alert.useMine ? t('Guna destinasi pemandu', 'Use the driver’s destination') : t('Beritahu bila dekat dengan saya', 'Tell me when they’re near me')}
      </button>
      {alert.useMine && <p className="mt-0.5 text-[11px] text-ink-500">{t('Lokasi anda hanya digunakan dalam telefon ini untuk kira jarak, tidak dihantar ke mana-mana.', 'Your location is only used on this phone to work out the distance and is never sent anywhere.')}</p>}
      {alert.mineError && <p className="mt-1 text-xs text-red-600">{alert.mineError}</p>}
      <p className="mt-1 text-[11px] text-ink-500">{alert.noWakeLock ? t('Biarkan skrin terbuka: bunyi tidak keluar bila telefon dikunci.', 'Keep the screen on: no sound plays while the phone is locked.') : t('Skrin dikekalkan hidup. Bunyi tidak keluar jika telefon dikunci atau halaman ditutup.', 'The screen stays on. No sound plays if the phone is locked or the page is closed.')}</p>
    </div>
  );
}

function ArrivedBanner({ name, where, ringing, onStop, onClose }: { name: string; where: string; ringing: boolean; onStop: () => void; onClose: () => void }) {
  const [t] = useT();
  return (
    <div role="alert" className="safe-top absolute inset-x-0 top-0 z-20 p-3">
      <div className="mx-auto flex max-w-md animate-slide-up items-center gap-3 rounded-3xl bg-jade-500 p-4 text-ink-950 shadow-float">
        <CheckCircle2 className="size-9 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-lg font-black leading-tight">{name} {t('dah sampai!', 'has arrived!')}</p>
          <p className="truncate text-sm">{t('di', 'icon at the')} {where}</p>
        </div>
        {ringing ? (
          <button type="button" onClick={onStop} className="flex shrink-0 items-center gap-1 rounded-xl bg-ink-950 px-3 py-2 text-sm font-bold text-white">
            <VolumeX className="size-4" /> {t('Hentikan bunyi', 'Stop sound')}
          </button>
        ) : (
          <button type="button" onClick={onClose} aria-label={t('Tutup', 'Close')} className="grid size-9 shrink-0 place-items-center rounded-full bg-ink-950/15">
            <X className="size-5" />
          </button>
        )}
      </div>
    </div>
  );
}
