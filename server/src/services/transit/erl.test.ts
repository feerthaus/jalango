import { describe, expect, it } from 'vitest';
import { erlFare, erlFeed } from './erl.js';
import { buildNetwork, planTransit, type TransitLeg } from './raptor.js';
import { deserializeNetwork, serializeNetwork } from './snapshot.js';

const KL_SENTRAL = { lat: 3.1342, lng: 101.6862 };
const SALAK_TINGGI = { lat: 2.8257, lng: 101.7134 };
const KLIA_T1 = { lat: 2.755, lng: 101.7049 };
const wed8am = Date.parse('2026-11-18T08:00:00+08:00');
const rides = (o: { legs: { type: string }[] }) => o.legs.filter((l): l is TransitLeg => l.type === 'transit');

describe('ERL feed', () => {
  const feed = erlFeed();

  it('has the six stations with clean names', () => {
    expect(feed.stops.map((s) => s.name)).toEqual(['KL Sentral', 'Bandar Tasik Selatan', 'Putrajaya & Cyberjaya', 'Salak Tinggi', 'KLIA T1', 'KLIA T2']);
  });

  it('runs every 15 minutes in the weekday peak and every 30 off-peak (KLIA Transit)', () => {
    const out = feed.trips.filter((t) => t.id.startsWith('erl:TRA-out-WD')).map((t) => t.dep[0]).sort((a, b) => a - b);
    const at = (h: number, m: number) => h * 3600 + m * 60;
    expect(out).toContain(at(7, 15));
    expect(out).not.toContain(at(10, 15));
    expect(out).toContain(at(10, 30));
    expect(out[0]).toBe(at(5, 0));
  });
});

describe('planning with KLIA Transit / Ekspres', () => {
  const net = buildNetwork([erlFeed()]);

  it('KL Sentral → Salak Tinggi: KLIA Transit, ~28 min, ERL fare', () => {
    const o = planTransit(net, KL_SENTRAL, SALAK_TINGGI, wed8am)[0];
    const r = rides(o);
    expect(r).toHaveLength(1);
    expect(r[0].mode).toBe('erl');
    expect(r[0].shortName).toBe('Transit');
    expect(r[0].to.name).toBe('Salak Tinggi');
    expect(r[0].stops).toBe(3);
    expect((Date.parse(r[0].arrive) - Date.parse(r[0].depart)) / 60_000).toBe(28);
    expect([r[0].fareMin, r[0].fareMax]).toEqual([18.3, 18.3]);
    expect(r[0].ticket).toBe(false);
  });

  it('KL Sentral → KLIA T1: the non-stop Ekspres is among the options', () => {
    const options = planTransit(net, KL_SENTRAL, KLIA_T1, wed8am);
    const eks = options.find((o) => rides(o)[0].shortName === 'Ekspres');
    expect(eks).toBeDefined();
    expect(rides(eks!)[0].stops).toBe(1);
    expect(rides(eks!)[0].fareMin).toBe(55);
  });

  it('survives the daily snapshot', () => {
    const plan = (n: typeof net) => planTransit(n, KL_SENTRAL, SALAK_TINGGI, wed8am).map((o) => rides(o).map((l) => `${l.shortName}${l.depart}`).join('|'));
    const back = deserializeNetwork(serializeNetwork(net, ['erl'])).net;
    expect(plan(back)).toEqual(plan(net));
  });
});

describe('erlFare', () => {
  const now = Date.parse('2026-11-18T08:00:00+08:00');
  const next = Date.parse('2027-01-02T08:00:00+08:00');
  it('uses the current table, then the 2027 one', () => {
    expect(erlFare('erl:KLS', 'erl:STG', now)).toEqual({ min: 18.3, max: 18.3 });
    expect(erlFare('erl:STG', 'erl:KLS', next)).toEqual({ min: 21.6, max: 21.6 });
    expect(erlFare('erl:KLS', 'erl:KT2', next)).toEqual({ min: 65, max: 65 });
  });
  it('estimates pairs the current table does not list', () => {
    const f = erlFare('erl:PJY', 'erl:STG', now);
    expect(f.min).toBeLessThan(5.6);
    expect(f.max).toBeLessThan(5.6);
    expect(f.min).toBeLessThanOrEqual(f.max);
  });
  it('charges the terminal shuttle fare between T1 and T2', () => {
    expect(erlFare('erl:KT1', 'erl:KT2', now)).toEqual({ min: 2, max: 2 });
  });
});
