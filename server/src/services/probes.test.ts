import { describe, expect, it } from 'vitest';
import { probeBatch } from './probes.js';

const now = Date.now();
const s = (dt: number, over: object = {}) => ({ t: now - 60_000 + dt, lat: 3.15, lng: 101.7, speed: 12.5, heading: 90, accuracy: 8, ...over });
const sessionId = '0b6f1a2e-4d3c-4b8a-9f00-123456789abc';

describe('probeBatch validation', () => {
  it('accepts a valid batch', () => {
    expect(probeBatch.safeParse({ sessionId, samples: [s(0), s(5000)] }).success).toBe(true);
  });
  it('rejects points outside Malaysia', () => {
    expect(probeBatch.safeParse({ sessionId, samples: [s(0, { lat: 13.7, lng: 100.5 })] }).success).toBe(false);
  });
  it('rejects non-increasing timestamps', () => {
    expect(probeBatch.safeParse({ sessionId, samples: [s(5000), s(0)] }).success).toBe(false);
  });
  it('rejects stale data and bad session ids', () => {
    expect(probeBatch.safeParse({ sessionId, samples: [s(-3 * 86_400_000)] }).success).toBe(false);
    expect(probeBatch.safeParse({ sessionId: 'user-123', samples: [s(0)] }).success).toBe(false);
  });
  it('rejects implausible speed and poor accuracy', () => {
    expect(probeBatch.safeParse({ sessionId, samples: [s(0, { speed: 120 })] }).success).toBe(false);
    expect(probeBatch.safeParse({ sessionId, samples: [s(0, { accuracy: 500 })] }).success).toBe(false);
  });
});
