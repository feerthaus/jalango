import { describe, expect, it } from 'vitest';
import { pinPlace } from './useDropPin';

describe('pinPlace', () => {
  it('keeps the exact pressed spot and names it after what is nearby', () => {
    const at = { lat: 2.831234, lng: 101.561234 };
    expect(pinPlace(at)).toMatchObject({ name: 'Pin di peta', coordinates: at, id: 'pin:2.831234,101.561234' });
    const p = pinPlace(at, { id: 'x', name: 'Jalan CJ 7', address: 'Banting, Selangor', coordinates: { lat: 2.9, lng: 101.6 }, kind: 'street', source: 'mapbox' });
    expect(p).toMatchObject({ name: 'Berhampiran Jalan CJ 7', address: 'Jalan CJ 7, Banting, Selangor', coordinates: at });
  });
});
