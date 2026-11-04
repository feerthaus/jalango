import { describe, expect, it } from 'vitest';
import { searchDemoPlaces } from './geocodingService';

describe('searchDemoPlaces', () => {
  it('matches by name', () => {
    expect(searchDemoPlaces('klcc')[0]?.id).toBe('demo:klcc');
  });

  it('matches by postcode', () => {
    expect(searchDemoPlaces('50470')[0]?.name).toBe('KL Sentral');
  });

  it('matches by state', () => {
    const names = searchDemoPlaces('sabah').map((p) => p.name);
    expect(names).toContain('Kota Kinabalu');
  });

  it('tags every result as demo data', () => {
    expect(searchDemoPlaces('kuala').every((p) => p.source === 'demo')).toBe(true);
  });

  it('ignores one-character queries', () => {
    expect(searchDemoPlaces('k')).toEqual([]);
  });
});
