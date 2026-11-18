import { describe, expect, it } from 'vitest';
import { parseFeed, railMode, ktmbMode, stationName } from './gtfs.js';
import { buildNetwork, estimateFare, planTransit } from './raptor.js';

// A small city: LRT line A (S1-S2-S3), LRT line B from S3b (next to S3) to S4,
// and KTMB ETS from K1 (next to S1… no: next to S2) to K2 far away.
const rail = parseFeed(
  'rail',
  {
    'stops.txt': `stop_id,stop_name,stop_lat,stop_lon
S1,ALPHA,3.100,101.600
S2,KL SENTRAL - REDONE,3.134,101.686
S3,BETA,3.150,101.710
S3b,BETA,3.1505,101.7105
S4,GAMMA,3.200,101.750`,
    'routes.txt': `route_id,route_short_name,route_long_name,route_color,category
A,KJL,Kelana Jaya Line,D50032,LRT
B,PYL,Putrajaya Line,FFCD00,MRT`,
    'trips.txt': `route_id,service_id,trip_id
A,wk,A1
B,wk,B1`,
    'stop_times.txt': `trip_id,arrival_time,departure_time,stop_id,stop_sequence
A1,7:00:00,7:00:00,S1,1
A1,7:10:00,7:10:30,S2,2
A1,7:20:00,7:20:00,S3,3
B1,7:00:00,7:00:00,S3b,1
B1,7:15:00,7:15:00,S4,2`,
    'frequencies.txt': `trip_id,start_time,end_time,headway_secs
A1,6:00:00,23:00:00,300
B1,6:00:00,23:00:00,600`,
    'calendar.txt': `service_id,monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date
wk,1,1,1,1,1,1,1,20260101,20261231`,
  },
  railMode,
);
const ktmb = parseFeed(
  'ktmb',
  {
    'stops.txt': `stop_id,stop_name,stop_lat,stop_lon
K1,KL SENTRAL,3.1345,101.6862
K2,IPOH,4.5975,101.0901`,
    'routes.txt': `route_id,route_short_name,route_long_name,route_color
ETS,ETS,Electric Train Service,FFC72C`,
    'trips.txt': `route_id,service_id,trip_id
ETS,ets,E1
ETS,ets,E2`,
    'stop_times.txt': `trip_id,arrival_time,departure_time,stop_id,stop_sequence
E1,09:00:00,09:00:00,K1,1
E1,11:30:00,11:30:00,K2,2
E2,13:00:00,13:00:00,K1,1
E2,15:30:00,15:30:00,K2,2`,
    'calendar.txt': `service_id,monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date
ets,1,1,1,1,1,1,1,20260101,20261231`,
  },
  ktmbMode,
);
const net = buildNetwork([rail, ktmb]);
const at8 = Date.parse('2026-11-18T08:00:00+08:00');

describe('GTFS feeds', () => {
  it('expands frequency trips and cleans station names', () => {
    expect(rail.trips.filter((t) => t.routeId === 'rail:A').length).toBe((23 - 6) * 12);
    expect(stationName('KL SENTRAL - REDONE')).toBe('KL Sentral');
    expect(rail.routes.map((r) => r.mode)).toEqual(['lrt', 'mrt']);
    expect(ktmb.routes[0].mode).toBe('ets');
  });

  it('joins nearby stations of different lines with a short walk', () => {
    const s3 = net.stopIndex.get('rail:S3')!;
    const s3b = net.stopIndex.get('rail:S3b')!;
    expect(net.footpaths[s3].map((f) => f.to)).toContain(s3b);
    const s2 = net.stopIndex.get('rail:S2')!;
    expect(net.footpaths[s2].map((f) => f.to)).toContain(net.stopIndex.get('ktmb:K1'));
  });
});

describe('public transport planner', () => {
  it('LRT then a walk to the MRT, one fare across Rapid KL lines', () => {
    const opts = planTransit(net, { lat: 3.1, lng: 101.601 }, { lat: 3.2, lng: 101.751 }, at8);
    expect(opts.length).toBeGreaterThan(0);
    const o = opts[0];
    expect(o.legs.map((l) => (l.type === 'walk' ? 'walk' : `${l.shortName}:${l.from.name}>${l.to.name}`))).toEqual(['KJL:Alpha>Beta', 'walk', 'PYL:Beta>Gamma']);
    const rides = o.legs.filter((l) => l.type === 'transit');
    expect(rides[1]).toMatchObject({ fareShared: true, fareMax: 0, ticket: false });
    expect(o.access.type).toBe('walk');
    expect(o.transfers).toBe(1);
  });

  it('LRT to KL Sentral, walk, ETS, leaving just in time (no hour-long wait)', () => {
    const opts = planTransit(net, { lat: 3.1, lng: 101.601 }, { lat: 4.5975, lng: 101.08 }, at8);
    expect(opts.map((o) => o.legs.filter((l) => l.type === 'transit').map((l) => (l.type === 'transit' ? l.mode : '')).join('+'))).toEqual(['lrt+ets', 'lrt+ets']);
    const first = opts[0];
    const ets = first.legs.find((l) => l.type === 'transit' && l.mode === 'ets');
    expect(ets && ets.type === 'transit' && ets.depart).toBe('2026-11-18T09:00:00+08:00');
    expect(ets && ets.type === 'transit' && ets.ticket).toBe(true);
    // the LRT leg arrives within ~25 min of the ETS (10 min at the platform + slack), not at 08:10
    const lrt = first.legs[0];
    expect(lrt.type === 'transit' && Date.parse('2026-11-18T09:00:00+08:00') - Date.parse(lrt.arrive)).toBeLessThanOrEqual(25 * 60_000);
    // the second option is the next ETS
    const ets2 = opts[1].legs.find((l) => l.type === 'transit' && l.mode === 'ets');
    expect(ets2 && ets2.type === 'transit' && ets2.depart).toBe('2026-11-18T13:00:00+08:00');
  });

  it('nothing for a short walk, or far from any station', () => {
    expect(planTransit(net, { lat: 3.1, lng: 101.6 }, { lat: 3.105, lng: 101.605 }, at8)).toEqual([]);
    expect(planTransit(net, { lat: 1.55, lng: 110.35 }, { lat: 1.6, lng: 110.4 }, at8)).toEqual([]);
  });

  it('fare estimates', () => {
    const lrt = estimateFare('lrt', 5);
    expect(lrt.min).toBeGreaterThanOrEqual(0.8);
    expect(lrt.max).toBeLessThanOrEqual(7.5);
    expect(estimateFare('lrt', 200).max).toBe(7.5);
  });
});
