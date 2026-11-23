import { afterEach, describe, expect, it, vi } from 'vitest';

describe('transitTrip when the browser blocks site data', () => {
  afterEach(() => {
    delete (globalThis as { localStorage?: unknown }).localStorage;
    vi.resetModules();
  });

  it('does not throw when reading localStorage itself throws (SecurityError)', async () => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw new DOMException("Failed to read the 'localStorage' property from 'Window': Access is denied for this document.", 'SecurityError');
      },
    });
    vi.resetModules();
    const m = await import('./transitTrip');
    // updateTransitProgress reads the stored trip through the same path the map's render uses
    expect(() => m.updateTransitProgress({} as Parameters<typeof m.updateTransitProgress>[0])).not.toThrow();
    expect(m.currentTransitTrip()).toBeNull();
    // the trip still works in memory until reload
    expect(() => m.endTransitTrip()).not.toThrow();
  });

  it('returns null when storage is simply unavailable', async () => {
    vi.resetModules();
    const m = await import('./transitTrip');
    expect(m.currentTransitTrip()).toBeNull();
  });
});
