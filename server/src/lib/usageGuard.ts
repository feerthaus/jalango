import { AsyncLocalStorage } from 'node:async_hooks';
import { HttpError } from './errors.js';
import { supabaseAdmin } from './supabaseAdmin.js';

export type UsageKind = 'directions' | 'geo' | 'google_places' | 'google_place_info';

/**
 * How a request behaves when the shared usage counter can't be reached:
 *  - critical (default: routing, search, reverse geocoding) — keep working on a
 *    small per-instance emergency budget, so a database hiccup never strands a driver;
 *  - optional (along-route search, nearby categories) — fail closed.
 */
export type UsagePolicy = 'critical' | 'optional';

/** Shared daily counter: adds `n` and returns today's total for `kind`. */
export type UsageCounter = (kind: UsageKind, n: number) => Promise<number>;

/** Daily ceilings for paid Mapbox calls (Malaysia time). Override with env vars. */
export function dailyLimit(kind: UsageKind): number {
  const raw =
    kind === 'directions' ? process.env.DAILY_LIMIT_DIRECTIONS
    : kind === 'geo' ? process.env.DAILY_LIMIT_GEO
    : kind === 'google_places' ? process.env.DAILY_LIMIT_GOOGLE_PLACES
    : process.env.DAILY_LIMIT_GOOGLE_PLACE_INFO;
  const n = Number(raw);
  // Google Places: 150 a day keeps a month under Google's 5,000 free Pro calls;
  // place info (rating, open now) is Enterprise: 30 a day stays under 1,000 a month.
  if (Number.isFinite(n) && n > 0) return n;
  return kind === 'google_places' ? 150 : kind === 'google_place_info' ? 30 : 3000;
}

/** Upstream calls one function instance may make per hour while the shared counter is down. */
export function emergencyLimit(kind: UsageKind): number {
  const n = Number(process.env.EMERGENCY_LIMIT_PER_HOUR);
  return Number.isFinite(n) && n > 0 ? n : kind === 'directions' ? 200 : kind === 'google_places' || kind === 'google_place_info' ? 10 : 300;
}

const supabaseCounter: UsageCounter | null = supabaseAdmin
  ? async (kind, n) => {
      // Mapbox kinds live in api_usage (read by admin stats); other providers in api_usage_extra.
      const fn = kind === 'directions' || kind === 'geo' ? 'bump_api_usage' : 'bump_api_usage_extra';
      const { data, error } = await supabaseAdmin!.rpc(fn, { p_kind: kind, p_n: n });
      if (error) throw new Error(error.message);
      if (typeof data !== 'number') throw new Error('unexpected counter response');
      return data;
    }
  : null;

let counter: UsageCounter | null = supabaseCounter;
let lastWarn = 0;
/** Tests swap the shared counter (null = not configured, e.g. local development). */
export function setUsageCounter(c: UsageCounter | null) {
  counter = c;
  emergency.clear();
  lastWarn = 0;
}

const policyStore = new AsyncLocalStorage<UsagePolicy>();
/** Run `fn` with a usage policy; every upstream call made inside it uses that policy. */
export function withUsagePolicy<T>(policy: UsagePolicy, fn: () => Promise<T>): Promise<T> {
  return policyStore.run(policy, fn);
}

const emergency = new Map<UsageKind, { count: number; resetAt: number }>();
function takeEmergency(kind: UsageKind, n: number): boolean {
  const now = Date.now();
  let b = emergency.get(kind);
  if (!b || b.resetAt <= now) {
    b = { count: 0, resetAt: now + 3600_000 };
    emergency.set(kind, b);
  }
  if (b.count + n > emergencyLimit(kind)) return false;
  b.count += n;
  return true;
}

/**
 * Call immediately before each paid upstream request (so retries and fan-out
 * are counted exactly once each). Throws 503 when today's ceiling is passed,
 * or when the counter is down and the policy doesn't allow carrying on.
 */
export async function guardUsage(kind: UsageKind, n = 1): Promise<void> {
  if (!counter) return; // no shared counter configured (local development)
  let total: number;
  try {
    total = await counter(kind, n);
  } catch (err) {
    if (Date.now() - lastWarn > 60_000) {
      lastWarn = Date.now();
      console.error('[usage] shared counter unavailable:', err instanceof Error ? err.message : err);
    }
    const policy = policyStore.getStore() ?? 'critical';
    if (policy === 'critical' && takeEmergency(kind, n)) return;
    throw new HttpError(503, 'usage_counter_unavailable', 'This service is temporarily unavailable. Please try again shortly.');
  }
  if (total > dailyLimit(kind)) {
    throw new HttpError(503, 'daily_quota', 'Daily limit reached for this service. It resets at midnight.');
  }
}
