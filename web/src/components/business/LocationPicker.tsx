import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Crosshair, Loader2, Search } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useLocation } from '@/contexts/LocationContext';
import { useTheme } from '@/contexts/ThemeContext';
import { DEFAULT_CENTER, env, features } from '@/lib/config';
import { styleFor } from '@/lib/mapStyles';
import { reverseGeocode, searchPlaces } from '@/services/geocodingService';
import type { Coordinates, Place } from '@/types';

if (env.mapboxToken) mapboxgl.accessToken = env.mapboxToken;

/**
 * Pick a premises location: "use my location", search (incl. a pasted Google Maps
 * link), or drag the pin. Reports the point and a short area name.
 */
export function LocationPicker({ value, onChange }: { value: Coordinates | null; onChange: (c: Coordinates, areaHint?: string) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const marker = useRef<mapboxgl.Marker | null>(null);
  const { fix, request } = useLocation();
  const { theme } = useTheme();
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Place[]>([]);
  const [busy, setBusy] = useState(false);
  const [waitingGps, setWaitingGps] = useState(false);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const place = async (c: Coordinates, zoom = 16, hint?: string) => {
    marker.current?.setLngLat([c.lng, c.lat]);
    map.current?.easeTo({ center: [c.lng, c.lat], zoom: Math.max(map.current.getZoom(), zoom) });
    let area = hint;
    if (!area) {
      try {
        const p = await reverseGeocode(c);
        area = p?.address?.split(',').slice(-3, -1).join(',').trim() || p?.name;
      } catch {
        /* no area name: fine */
      }
    }
    onChangeRef.current(c, area);
  };

  useEffect(() => {
    if (!box.current) return;
    const start = value ?? fix?.coordinates ?? DEFAULT_CENTER;
    let m: mapboxgl.Map;
    try {
      m = new mapboxgl.Map({ container: box.current, style: styleFor(theme === 'dark' ? 'dark' : 'light', features.mapboxTiles), center: [start.lng, start.lat], zoom: value ? 16 : 12, attributionControl: false });
    } catch {
      return;
    }
    map.current = m;
    m.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-right');
    const mk = new mapboxgl.Marker({ color: '#e11d48', draggable: true }).setLngLat([start.lng, start.lat]).addTo(m);
    mk.on('dragend', () => {
      const p = mk.getLngLat();
      void place({ lng: p.lng, lat: p.lat });
    });
    m.on('click', (e) => void place({ lng: e.lngLat.lng, lat: e.lngLat.lat }));
    marker.current = mk;
    return () => {
      m.remove();
      map.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // "Use my location" waits for the first GPS fix if needed
  useEffect(() => {
    if (waitingGps && fix) {
      setWaitingGps(false);
      void place(fix.coordinates, 17);
    }
  }, [waitingGps, fix]); // eslint-disable-line react-hooks/exhaustive-deps

  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    if (q.trim().length < 2) return;
    setBusy(true);
    try {
      const r = await searchPlaces(q.trim(), { near: fix?.coordinates ?? null, live: true });
      setResults(r.results.slice(0, 5));
    } catch {
      setResults([]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => {
            if (fix) void place(fix.coordinates, 17);
            else {
              request();
              setWaitingGps(true);
            }
          }}
          className="flex shrink-0 items-center gap-1.5 rounded-xl bg-jade-500 px-3 py-2 text-sm font-semibold text-white"
        >
          {waitingGps ? <Loader2 className="size-4 animate-spin" /> : <Crosshair className="size-4" />} Lokasi saya
        </button>
        <form onSubmit={search} className="flex min-w-0 flex-1 items-center gap-1 rounded-xl bg-ink-100 px-2 dark:bg-ink-800">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari alamat / tampal link Google Maps" aria-label="Cari lokasi" className="min-w-0 flex-1 bg-transparent py-2 text-base outline-none" />
          <button type="submit" aria-label="Cari" className="grid size-8 place-items-center">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
          </button>
        </form>
      </div>
      {results.length > 0 && (
        <ul className="overflow-hidden rounded-xl ring-1 ring-ink-200 dark:ring-ink-700">
          {results.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => {
                  setResults([]);
                  void place(r.coordinates, 16, r.address?.split(',').slice(-3, -1).join(',').trim() || r.name);
                }}
                className="block w-full px-3 py-2 text-left text-sm hover:bg-ink-100 dark:hover:bg-ink-800"
              >
                <span className="block font-medium">{r.name}</span>
                <span className="block truncate text-xs text-ink-500">{r.address}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <div ref={box} className="h-56 w-full overflow-hidden rounded-xl bg-ink-100 dark:bg-ink-800" aria-label="Peta lokasi: seret pin atau tekan peta" />
      <p className="text-xs text-ink-500">{value ? `📍 ${value.lat.toFixed(5)}, ${value.lng.toFixed(5)} · seret pin untuk betulkan` : 'Tekan "Lokasi saya" di premis, cari alamat, atau tekan peta.'}</p>
    </div>
  );
}
