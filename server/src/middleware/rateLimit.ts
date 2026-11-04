import type { RequestHandler } from 'express';

interface Bucket {
  count: number;
  resetAt: number;
}

/**
 * Minimal fixed-window, in-memory rate limiter keyed by client IP.
 * Good enough for a single instance; swap for Redis when scaling out.
 */
export function rateLimit({ windowMs, max }: { windowMs: number; max: number }): RequestHandler {
  const buckets = new Map<string, Bucket>();

  return (req, res, next) => {
    const now = Date.now();
    const key = req.ip ?? 'unknown';
    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(key, bucket);
    }
    bucket.count += 1;

    if (buckets.size > 10_000) {
      for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
    }

    if (bucket.count > max) {
      res.setHeader('Retry-After', Math.ceil((bucket.resetAt - now) / 1000));
      res.status(429).json({ error: { code: 'rate_limited', message: 'Too many requests, slow down.' } });
      return;
    }
    next();
  };
}
