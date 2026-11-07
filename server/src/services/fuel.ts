import { HttpError } from '../lib/errors.js';

/**
 * Weekly retail fuel prices from the official open data portal (data.gov.my,
 * catalogue "fuelprice", Ministry of Finance). Cached for 6 hours.
 */
const URL_ = 'https://api.data.gov.my/data-catalogue?id=fuelprice&sort=-date&limit=6';
const CACHE_MS = 6 * 3600_000;
let cache: { at: number; value: FuelPrices } | null = null;

export interface FuelPrices {
  /** effective date of this week's prices (YYYY-MM-DD) */
  date: string;
  /** RM per litre, keyed by the dataset's column names (ron95, ron97, diesel, …) */
  prices: Record<string, number>;
  /** change from the previous week, same keys (absent when unknown) */
  change: Record<string, number>;
  source: string;
}

type Row = Record<string, unknown>;

export function pickLatest(rows: Row[]): FuelPrices | null {
  const numeric = (r: Row) => Object.fromEntries(Object.entries(r).filter(([k, v]) => k !== 'date' && typeof v === 'number' && Number.isFinite(v)) as [string, number][]);
  const levels = rows.filter((r) => (r.series_type ?? 'level') === 'level' && typeof r.date === 'string').sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const latest = levels[0];
  if (!latest) return null;
  const changeRow = rows.find((r) => r.series_type === 'change_weekly' && r.date === latest.date);
  return { date: String(latest.date), prices: numeric(latest), change: changeRow ? numeric(changeRow) : {}, source: 'data.gov.my (fuelprice)' };
}

export async function getFuelPrices(): Promise<FuelPrices> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.value;
  try {
    const res = await fetch(URL_, { signal: AbortSignal.timeout(6000), headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const value = pickLatest((await res.json()) as Row[]);
    if (!value) throw new Error('no rows');
    cache = { at: Date.now(), value };
    return value;
  } catch (err) {
    if (cache) return cache.value; // last known prices beat nothing
    throw new HttpError(502, 'upstream_unreachable', `Fuel prices unavailable (${err instanceof Error ? err.message : 'error'})`);
  }
}
