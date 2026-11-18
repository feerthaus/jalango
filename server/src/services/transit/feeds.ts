import { strFromU8, unzipSync } from 'fflate';
import { HttpError } from '../../lib/errors.js';
import { ktmbMode, parseFeed, railMode, type Feed, type Mode } from './gtfs.js';
import { buildNetwork, type Network } from './raptor.js';

/**
 * The public transport network: official GTFS from data.gov.my, joined into
 * one network. Each server instance keeps it 6 hours; a feed that can't be
 * fetched keeps its last good copy, and the others still work.
 */
const SOURCES: { name: string; url: string; mode: (r: Record<string, string>) => Mode }[] = [
  { name: 'ktmb', url: 'https://api.data.gov.my/gtfs-static/ktmb', mode: ktmbMode },
  { name: 'rail', url: 'https://api.data.gov.my/gtfs-static/prasarana?category=rapid-rail-kl', mode: railMode },
];
const CACHE_MS = 6 * 3600_000;
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

async function fetchFeed(src: (typeof SOURCES)[number]): Promise<Feed> {
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

export async function getTransitNetwork(): Promise<Network> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.value;
  loading ??= Promise.allSettled(SOURCES.map(fetchFeed))
    .then((results) => {
      const feeds = results.filter((r): r is PromiseFulfilledResult<Feed> => r.status === 'fulfilled').map((r) => r.value);
      if (!feeds.length) throw new Error('no feed');
      const value = buildNetwork(feeds);
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

/** Tests: a fixed network. */
export function setTransitNetwork(value: Network | null): void {
  cache = value ? { at: Date.now(), value } : null;
}
