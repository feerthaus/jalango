import { strFromU8, unzipSync } from 'fflate';
import { HttpError } from '../../lib/errors.js';
import { supabaseAdmin } from '../../lib/supabaseAdmin.js';
import { busMode, ktmbMode, parseFeed, railMode, type Feed, type Mode } from './gtfs.js';
import { buildNetwork, type Network } from './raptor.js';
import { deserializeNetwork, serializeNetwork, SNAPSHOT_VERSION } from './snapshot.js';

/**
 * The public transport network: official GTFS from data.gov.my.
 *  - Trains and city rail (small) can be fetched and parsed on the spot.
 *  - Buses (~50 MB of timetables) are parsed once a day by a scheduled function
 *    into a compact snapshot kept in Supabase Storage; the API loads that.
 * Order of preference: memory (6 h) → snapshot (< 36 h old) → trains + rail live.
 */
type Source = { name: string; url: string; mode: (r: Record<string, string>) => Mode };
const GTFS = 'https://api.data.gov.my/gtfs-static';
export const CORE: Source[] = [
  { name: 'ktmb', url: `${GTFS}/ktmb`, mode: ktmbMode },
  { name: 'rail', url: `${GTFS}/prasarana?category=rapid-rail-kl`, mode: railMode },
];
export const BUSES: Source[] = [
  { name: 'buskl', url: `${GTFS}/prasarana?category=rapid-bus-kl`, mode: busMode },
  { name: 'feeder', url: `${GTFS}/prasarana?category=rapid-bus-mrtfeeder`, mode: busMode },
  { name: 'penang', url: `${GTFS}/prasarana?category=rapid-bus-penang`, mode: busMode },
  { name: 'mybas', url: `${GTFS}/mybas-johor`, mode: busMode },
];

const BUCKET = 'transit';
const OBJECT = `network-v${SNAPSHOT_VERSION}.json.gz`;
const CACHE_MS = 6 * 3600_000;
const SNAPSHOT_MAX_AGE_MS = 36 * 3600_000;
const lastGood = new Map<string, Feed>();
let cache: { at: number; value: Network } | null = null;
let loading: Promise<Network> | null = null;

export function unzipGtfs(buf: ArrayBuffer): Record<string, string> {
  const files: Record<string, string> = {};
  for (const [path, data] of Object.entries(unzipSync(new Uint8Array(buf)))) {
    const name = path.split('/').pop()!;
    if (path.startsWith('__MACOSX') || name.startsWith('._') || !name.endsWith('.txt')) continue;
    files[name] = strFromU8(data);
  }
  return files;
}

async function fetchFeed(src: Source): Promise<Feed> {
  try {
    const res = await fetch(src.url, { signal: AbortSignal.timeout(20_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const feed = parseFeed(src.name, unzipGtfs(await res.arrayBuffer()), src.mode);
    lastGood.set(src.name, feed);
    return feed;
  } catch (err) {
    const old = lastGood.get(src.name);
    if (old) return old;
    throw err;
  }
}

async function fetchFeeds(sources: Source[]): Promise<Feed[]> {
  const results = await Promise.allSettled(sources.map(fetchFeed));
  results.forEach((r, i) => r.status === 'rejected' && console.warn(`[transit] ${sources[i].name} skipped:`, r.reason instanceof Error ? r.reason.message : r.reason));
  return results.filter((r): r is PromiseFulfilledResult<Feed> => r.status === 'fulfilled').map((r) => r.value);
}

/** Today's snapshot from storage, if there is a recent one. */
async function loadSnapshot(): Promise<Network | null> {
  if (!supabaseAdmin) return null;
  const { data, error } = await supabaseAdmin.storage.from(BUCKET).download(OBJECT);
  if (error || !data) return null;
  const { net, builtAt } = deserializeNetwork(new Uint8Array(await data.arrayBuffer()));
  return Date.now() - Date.parse(builtAt) < SNAPSHOT_MAX_AGE_MS ? net : null;
}

export async function getTransitNetwork(): Promise<Network> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.value;
  loading ??= (async () => {
    const snap = await loadSnapshot().catch((err) => {
      console.warn('[transit] snapshot not loaded:', err instanceof Error ? err.message : err);
      return null;
    });
    if (snap) return snap;
    // No snapshot: trains and city rail are quick enough to load now
    const feeds = await fetchFeeds(CORE);
    if (!feeds.length) throw new Error('no feed');
    return buildNetwork(feeds);
  })()
    .then((value) => {
      cache = { at: Date.now(), value };
      return value;
    })
    .catch((err) => {
      if (cache) return cache.value;
      throw new HttpError(502, 'upstream_unreachable', `Public transport timetables unavailable (${err instanceof Error ? err.message : 'error'})`);
    })
    .finally(() => {
      loading = null;
    });
  return loading;
}

/** Scheduled (daily): fetch every feed, build the network, store the snapshot. */
export async function rebuildSnapshot(): Promise<{ feeds: string[]; stops: number; patterns: number; bytes: number }> {
  if (!supabaseAdmin) throw new Error('Supabase is not configured');
  const feeds = await fetchFeeds([...CORE, ...BUSES]);
  if (!feeds.some((f) => f.name === 'ktmb' || f.name === 'rail')) throw new Error('core feeds missing');
  const net = buildNetwork(feeds);
  const bytes = serializeNetwork(net, feeds.map((f) => f.name));
  const { error } = await supabaseAdmin.storage.from(BUCKET).upload(OBJECT, bytes, { contentType: 'application/gzip', upsert: true });
  if (error) throw new Error(`upload: ${error.message}`);
  cache = { at: Date.now(), value: net };
  return { feeds: feeds.map((f) => f.name), stops: net.stops.length, patterns: net.patterns.length, bytes: bytes.byteLength };
}

/** Tests: a fixed network. */
export function setTransitNetwork(value: Network | null): void {
  cache = value ? { at: Date.now(), value } : null;
}
