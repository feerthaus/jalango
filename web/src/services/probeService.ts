import { env } from '@/lib/config';
import type { Coordinates, GeoFix } from '@/types';
import { haversineMeters } from '@/utils/geo';

/**
 * Opt-in, anonymous traffic data collection while navigating.
 *
 * Privacy rules applied on-device before anything is sent:
 *  - only while navigating, and only after the user agreed
 *  - a random id per trip, never the user id
 *  - nothing within PRIVACY_RADIUS of the trip's start or destination
 *  - low-accuracy fixes are dropped; samples are thinned to ~1 per 5 s / 75 m
 */
const PRIVACY_RADIUS_M = 300;
const MIN_INTERVAL_MS = 5_000;
const MIN_DISTANCE_M = 75;
const MAX_ACCURACY_M = 50;
const FLUSH_EVERY_MS = 60_000;
const FLUSH_AT = 30;
const MAX_BUFFER = 120;

interface Sample {
  t: number;
  lat: number;
  lng: number;
  speed: number | null;
  heading: number | null;
  accuracy: number;
}

export class ProbeCollector {
  private readonly sessionId = crypto.randomUUID();
  private buffer: Sample[] = [];
  private last: Sample | null = null;
  private lastFlush = Date.now();
  private sending = false;
  private stopped = false;
  private readonly onPageHide = () => this.flush(true);

  constructor(
    private readonly origin: Coordinates,
    private readonly destination: Coordinates,
  ) {
    window.addEventListener('pagehide', this.onPageHide);
  }

  add(fix: GeoFix): void {
    if (this.stopped || fix.accuracy > MAX_ACCURACY_M) return;
    const p = fix.coordinates;
    if (haversineMeters(p, this.origin) < PRIVACY_RADIUS_M || haversineMeters(p, this.destination) < PRIVACY_RADIUS_M) return;

    if (this.last) {
      const dt = fix.timestamp - this.last.t;
      if (dt <= 0) return;
      if (dt < MIN_INTERVAL_MS && haversineMeters(p, this.last) < MIN_DISTANCE_M) return;
    }

    const sample: Sample = {
      t: Math.round(fix.timestamp),
      lat: round(p.lat, 6),
      lng: round(p.lng, 6),
      speed: fix.speed !== null && fix.speed <= 70 ? round(fix.speed, 2) : null,
      heading: fix.heading !== null ? round(fix.heading, 1) : null,
      accuracy: round(fix.accuracy, 1),
    };
    this.last = sample;
    this.buffer.push(sample);
    if (this.buffer.length > MAX_BUFFER) this.buffer.splice(0, this.buffer.length - MAX_BUFFER);

    if (this.buffer.length >= FLUSH_AT || Date.now() - this.lastFlush > FLUSH_EVERY_MS) void this.flush();
  }

  async flush(useBeacon = false): Promise<void> {
    if (this.sending || this.buffer.length === 0) return;
    const batch = this.buffer;
    this.buffer = [];
    this.lastFlush = Date.now();
    const body = JSON.stringify({ sessionId: this.sessionId, samples: batch });
    const url = `${env.apiBaseUrl}/api/probes`;

    if (useBeacon && navigator.sendBeacon) {
      navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }));
      return;
    }
    this.sending = true;
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true });
      // 4xx = invalid data, don't retry; 5xx/429 = put back and retry later
      if (res.status >= 500 || res.status === 429) this.requeue(batch);
    } catch {
      this.requeue(batch);
    } finally {
      this.sending = false;
    }
  }

  stop(): void {
    if (this.stopped) return;
    void this.flush();
    this.stopped = true;
    window.removeEventListener('pagehide', this.onPageHide);
  }

  private requeue(batch: Sample[]) {
    this.buffer = [...batch, ...this.buffer].slice(-MAX_BUFFER);
  }
}

function round(n: number, digits: number): number {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}
