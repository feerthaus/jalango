import { HttpError } from './errors.js';
import { supabaseAdmin } from './supabaseAdmin.js';

export type UsageKind = 'directions' | 'geo';

/** Daily ceilings for paid Mapbox calls (Malaysia time). Override with env vars. */
export function dailyLimit(kind: UsageKind): number {
  const raw = kind === 'directions' ? process.env.DAILY_LIMIT_DIRECTIONS : process.env.DAILY_LIMIT_GEO;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 3000;
}

/**
 * Count `n` upstream calls and refuse once today's ceiling is passed.
 * Fails open (allows the call) if the counter itself is unavailable, so a
 * database hiccup never breaks navigation.
 */
export async function guardUsage(kind: UsageKind, n = 1): Promise<void> {
  if (!supabaseAdmin) return;
  let count: number | null = null;
  try {
    const { data, error } = await supabaseAdmin.rpc('bump_api_usage', { p_kind: kind, p_n: n });
    if (error) throw error;
    count = typeof data === 'number' ? data : null;
  } catch (err) {
    console.warn('[usage] counter unavailable', err instanceof Error ? err.message : err);
    return;
  }
  if (count !== null && count > dailyLimit(kind)) {
    throw new HttpError(503, 'daily_quota', 'Daily limit reached for this service. It resets at midnight.');
  }
}
