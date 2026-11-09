import { describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import { clientIp, hashKey, rateLimit, type DistributedCounter } from './rateLimit.js';

function req(ip: string, headers: Record<string, string> = {}): Request {
  return { ip, headers } as unknown as Request;
}
function res() {
  const r = { statusCode: 200, headers: {} as Record<string, unknown>, body: null as unknown };
  return Object.assign(r, {
    setHeader: (k: string, v: unknown) => ((r.headers[k] = v), r),
    status: (c: number) => ((r.statusCode = c), r),
    json: (b: unknown) => ((r.body = b), r),
  }) as typeof r & Response;
}
async function hit(mw: ReturnType<typeof rateLimit>, rq: Request) {
  const rs = res();
  const next = vi.fn();
  await mw(rq, rs, next);
  return { passed: next.mock.calls.length === 1, rs };
}

describe('clientIp', () => {
  it('prefers the Netlify client header, falls back to req.ip', () => {
    expect(clientIp(req('10.0.0.1', { 'x-nf-client-connection-ip': '203.0.113.7' }))).toBe('203.0.113.7');
    expect(clientIp(req('10.0.0.1'))).toBe('10.0.0.1');
  });
});

describe('hashKey', () => {
  it('never contains the raw IP and is stable per endpoint', () => {
    const k = hashKey('203.0.113.7', 'directions', 's3cret');
    expect(k).not.toContain('203.0.113.7');
    expect(k).toBe(hashKey('203.0.113.7', 'directions', 's3cret'));
    expect(k).not.toBe(hashKey('203.0.113.7', 'geo', 's3cret'));
    expect(k).not.toBe(hashKey('203.0.113.7', 'directions', 'other-secret'));
  });
});

describe('rateLimit', () => {
  it('in-memory layer: allows up to max, then 429 with Retry-After and the same error body', async () => {
    const mw = rateLimit({ name: 't', windowMs: 60_000, max: 2, counter: null });
    expect((await hit(mw, req('1.1.1.1'))).passed).toBe(true);
    expect((await hit(mw, req('1.1.1.1'))).passed).toBe(true);
    const third = await hit(mw, req('1.1.1.1'));
    expect(third.passed).toBe(false);
    expect(third.rs.statusCode).toBe(429);
    expect(third.rs.headers['Retry-After']).toBeGreaterThan(0);
    expect(third.rs.body).toEqual({ error: { code: 'rate_limited', message: 'Too many requests, slow down.' } });
    // other visitors are unaffected
    expect((await hit(mw, req('2.2.2.2'))).passed).toBe(true);
  });

  it('shared layer: enforces the limit across instances', async () => {
    // Simulates another function instance having already used up the window
    const counter: DistributedCounter = vi.fn(async () => 61);
    const mw = rateLimit({ name: 'directions', windowMs: 60_000, max: 60, counter });
    const r = await hit(mw, req('3.3.3.3'));
    expect(r.passed).toBe(false);
    expect(r.rs.statusCode).toBe(429);
    expect(counter).toHaveBeenCalledWith(expect.stringMatching(/^directions:/), 60);
  });

  it('shared counter failure falls back to the per-instance limit (never wide open)', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const counter: DistributedCounter = vi.fn(async () => {
      throw new Error('db down');
    });
    const mw = rateLimit({ name: 'geo', windowMs: 60_000, max: 1, counter });
    expect((await hit(mw, req('4.4.4.4'))).passed).toBe(true);
    expect((await hit(mw, req('4.4.4.4'))).rs.statusCode).toBe(429);
    warn.mockRestore();
  });

  it('does not call the shared counter once the in-memory layer already rejected', async () => {
    const counter: DistributedCounter = vi.fn(async () => 1);
    const mw = rateLimit({ name: 'x', windowMs: 60_000, max: 1, counter });
    await hit(mw, req('5.5.5.5'));
    await hit(mw, req('5.5.5.5'));
    expect(counter).toHaveBeenCalledTimes(1);
  });
});
