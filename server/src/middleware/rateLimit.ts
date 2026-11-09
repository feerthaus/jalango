import { createHmac } from 'node:crypto';
import type { Request, RequestHandler } from 'express';
import { config } from '../config.js';
import { supabaseAdmin } from '../lib/supabaseAdmin.js';

interface Bucket {
  count: number;
  resetAt: number;
}

/** Shared counter: returns the hit count for `key` in the current window. */
export type DistributedCounter = (key: string, windowSeconds: number) => Promise<number>;

/**
 * The visitor's real IP. On Netlify every request arrives through their proxy,
 * which sets x-nf-client-connection-ip (overwriting any client-supplied value);
 * locally Express's req.ip is used.
 */
export function clientIp(req: Request): string {
  const nf = req.headers['x-nf-client-connection-ip'];
  const fromNetlify = Array.isArray(nf) ? nf[0] : nf;
  return (fromNetlify && fromNetlify.trim()) || req.ip || 'unknown';
}

/** HMAC so the database never holds raw IP addresses (PDPA), and hashes can't be reversed by brute force. */
export function hashKey(ip: string, name: string, secret = process.env.RATE_LIMIT_SECRET || config.supabaseServiceRoleKey || 'jalango-dev'): string {
  return `${name}:${createHmac('sha256', secret).update(ip).digest('base64url').slice(0, 32)}`;
}

const supabaseCounter: DistributedCounter | null = supabaseAdmin
  ? async (key, windowSeconds) => {
      const { data, error } = await supabaseAdmin!.rpc('hit_rate_limit', { p_key: key, p_window_seconds: windowSeconds });
      if (error) throw new Error(error.message);
      if (typeof data !== 'number') throw new Error('unexpected counter response');
      return data;
    }
  : null;

let lastWarn = 0;
function warnOnce(err: unknown) {
  if (Date.now() - lastWarn < 60_000) return;
  lastWarn = Date.now();
  console.warn('[rate-limit] shared counter unavailable, using per-instance limits only:', err instanceof Error ? err.message : err);
}

/**
 * Fixed-window rate limiter keyed by client IP, in two layers:
 *  1. in-memory per function instance — free, stops floods before any I/O;
 *  2. a shared counter in Supabase — the real limit across all serverless instances.
 * If the shared counter is down, layer 1 still applies (never wide open).
 */
export function rateLimit({
  name,
  windowMs,
  max,
  counter = supabaseCounter,
}: {
  name: string;
  windowMs: number;
  max: number;
  counter?: DistributedCounter | null;
}): RequestHandler {
  const buckets = new Map<string, Bucket>();
  const windowSeconds = Math.max(1, Math.round(windowMs / 1000));

  const reject = (res: Parameters<RequestHandler>[1], resetAt: number) => {
    res.setHeader('Retry-After', Math.max(1, Math.ceil((resetAt - Date.now()) / 1000)));
    res.status(429).json({ error: { code: 'rate_limited', message: 'Too many requests, slow down.' } });
  };

  return async (req, res, next) => {
    const now = Date.now();
    const ip = clientIp(req);
    let bucket = buckets.get(ip);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(ip, bucket);
    }
    bucket.count += 1;
    if (buckets.size > 10_000) {
      for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
    }
    if (bucket.count > max) return reject(res, bucket.resetAt);

    if (counter) {
      try {
        const count = await counter(hashKey(ip, name), windowSeconds);
        if (count > max) {
          const windowEnd = (Math.floor(now / 1000 / windowSeconds) + 1) * windowSeconds * 1000;
          return reject(res, windowEnd);
        }
      } catch (err) {
        warnOnce(err);
      }
    }
    next();
  };
}
