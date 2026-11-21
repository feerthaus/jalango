import { describe, expect, it } from 'vitest';
import { plazaKey, priceTolls, type TollTable } from './tolls.js';

// Made-up rates for the tests only (the real table holds official rates)
const T: TollTable = {
  asOf: 'test',
  source: 'test',
  open: { sunway: 1.5, 'awan besar': 1.6, 'salak selatan': 1.1, 'seri muda': 1.2 },
  closed: {
    plus: { plazas: ['sungai besi', 'ayer keroh', 'jalan duta', 'ipoh selatan'], fares: { 'ayer keroh|sungai besi': 12.5, 'ipoh selatan|jalan duta': 20.4 } },
  },
};
const booth = (name?: string) => ({ type: 'booth' as const, name, location: { lat: 3, lng: 101 } });

describe('toll fares', () => {
  it('normalises plaza names', () => {
    expect(plazaKey('Plaza Tol Sunway (Arah Timur)')).toBe('sunway');
    expect(plazaKey('Plaza Tol Sungai Besi')).toBe('sungai besi');
    expect(plazaKey(undefined)).toBeNull();
  });

  it('prices a closed-system trip by its entry and exit plazas', () => {
    expect(priceTolls([booth('Plaza Tol Sungai Besi'), booth('Plaza Tol Ayer Keroh')], T)).toEqual({ total: 12.5, priced: 1, unknown: [] });
    expect(priceTolls([booth('Plaza Tol Jalan Duta'), booth('Plaza Tol Ipoh Selatan')], T).total).toBe(20.4);
  });

  it('adds up open-system plazas (Shah Alam → KLCC)', () => {
    const r = priceTolls([booth('Plaza Tol Seri Muda (Arah Selatan)'), booth('Plaza Tol Sunway (Arah Timur)'), booth('Plaza Tol Awan Besar (Arah Timur)'), booth('Plaza Tol Salak Selatan')], T);
    expect(r).toEqual({ total: 5.4, priced: 4, unknown: [] });
  });

  it('gives no total when any plaza is unknown or unnamed (the estimate stays)', () => {
    expect(priceTolls([booth('Plaza Tol Sungai Besi'), booth(undefined)], T).total).toBeNull(); // KL → JB today
    expect(priceTolls([booth('Plaza Tol Putrajaya'), booth('Plaza Tol KLIA')], T)).toMatchObject({ total: null, unknown: ['Plaza Tol Putrajaya', 'Plaza Tol KLIA'] });
    expect(priceTolls([booth('Plaza Tol Sungai Besi')], T).unknown).toEqual(['sungai besi → ?']);
    expect(priceTolls([], T).total).toBeNull();
  });

  it('ignores the same plaza listed twice in a row', () => {
    expect(priceTolls([booth('Plaza Tol Sunway'), booth('Plaza Tol Sunway')], T).total).toBe(1.5);
  });

  it('the shipped table holds no unverified rates', async () => {
    const { TOLL_TABLE } = await import('./tolls.js');
    const any = Object.keys(TOLL_TABLE.open).length + Object.keys(TOLL_TABLE.closed).length;
    if (any) {
      expect(TOLL_TABLE.source).not.toBe('');
      expect(TOLL_TABLE.asOf).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});
