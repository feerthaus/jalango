import { HttpError } from '../lib/errors.js';

/**
 * Fixed speed cameras (AES / AWAS) from OpenStreetMap (highway=speed_camera),
 * fetched per 0.5° tile from the public Overpass API. © OpenStreetMap contributors (ODbL).
 */
export const TILE_DEG = 0.5;

export interface SpeedCamera {
  id: string;
  lat: number;
  lng: number;
  /** km/h from the OSM maxspeed tag, if mapped */
  maxspeed: number | null;
}

const ENDPOINTS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://overpass.private.coffee/api/interpreter'];
const TIMEOUT_MS = 7000;
const cache = new Map<string, { at: number; cameras: SpeedCamera[] }>();
const CACHE_MS = 6 * 3600_000;

export function tileBounds(x: number, y: number) {
  const minLng = x * TILE_DEG;
  const minLat = y * TILE_DEG;
  return { minLat, minLng, maxLat: minLat + TILE_DEG, maxLng: minLng + TILE_DEG };
}

export function parseMaxspeed(tag: string | undefined): number | null {
  if (!tag) return null;
  const m = tag.match(/^(\d{2,3})\s*(mph)?/);
  if (!m) return null;
  const n = Number(m[1]);
  return m[2] ? Math.round(n * 1.609) : n;
}

interface OverpassElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  tags?: Record<string, string>;
}

export function toCameras(elements: OverpassElement[]): SpeedCamera[] {
  return elements
    .filter((e) => e.type === 'node' && typeof e.lat === 'number' && typeof e.lon === 'number')
    .map((e) => ({ id: `osm:${e.id}`, lat: e.lat!, lng: e.lon!, maxspeed: parseMaxspeed(e.tags?.maxspeed) }));
}

export async function camerasInTile(x: number, y: number): Promise<SpeedCamera[]> {
  const key = `${x}:${y}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.cameras;
  const b = tileBounds(x, y);
  const query = `[out:json][timeout:7];node["highway"="speed_camera"](${b.minLat},${b.minLng},${b.maxLat},${b.maxLng});out body;`;
  // Netlify functions have ~10 s: ask the mirrors in parallel and take the first good answer
  const ask = async (url: string): Promise<SpeedCamera[]> => {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'JalanGo/1.0 (+https://jalango.netlify.app)' },
      body: `data=${encodeURIComponent(query)}`,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`Overpass ${res.status}`);
    const body = (await res.json()) as { elements?: OverpassElement[] };
    return toCameras(body.elements ?? []);
  };
  let lastErr: unknown = null;
  try {
    const cameras = await Promise.any(ENDPOINTS.map(ask));
    cache.set(key, { at: Date.now(), cameras });
    return cameras;
  } catch (err) {
    lastErr = err instanceof AggregateError ? err.errors[0] : err;
  }
  if (hit) return hit.cameras; // stale is better than nothing
  throw new HttpError(502, 'upstream_unreachable', `Camera data unavailable (${lastErr instanceof Error ? lastErr.message : 'error'})`);
}
