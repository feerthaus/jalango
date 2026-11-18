import { describe, expect, it } from 'vitest';
import { busMode, parseFeed, railMode, stationName } from './gtfs.js';
import { buildNetwork, planTransit } from './raptor.js';
import { deserializeNetwork, serializeNetwork } from './snapshot.js';

const cal = `service_id,monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date
wk,1,1,1,1,1,1,1,20260101,20261231`;
const rail = parseFeed(
  'rail',
  {
    'stops.txt': 'stop_id,stop_name,stop_lat,stop_lon\nS1,ALPHA,3.100,101.600\nS2,BETA,3.150,101.710',
    'routes.txt': 'route_id,route_short_name,route_long_name,route_color,category\nA,KJL,Kelana Jaya Line,D50032,LRT',
    'trips.txt': 'route_id,service_id,trip_id\nA,wk,A1',
    'stop_times.txt': 'trip_id,arrival_time,departure_time,stop_id,stop_sequence\nA1,7:00:00,7:00:30,S1,1\nA1,7:20:00,7:20:00,S2,2',
    'frequencies.txt': 'trip_id,start_time,end_time,headway_secs\nA1,6:00:00,23:00:00,300',
    'calendar.txt': cal,
  },
  railMode,
);
const bus = parseFeed(
  'feeder',
  {
    'stops.txt': 'stop_id,stop_name,stop_lat,stop_lon\nB1,PJ790 SRA SEKSYEN 5,3.1505,101.7105\nB2,KL1117 LRT BANGSAR,3.200,101.750\nB3,SS15 COURTYARD,3.075,101.590',
    'routes.txt': 'route_id,route_short_name,route_long_name\n300,,T117',
    'trips.txt': 'route_id,service_id,trip_id\n300,wk,T1',
    'stop_times.txt': 'trip_id,arrival_time,departure_time,stop_id,stop_sequence\nT1,07:30:00,07:30:00,B1,1\nT1,07:50:00,07:50:00,B2,2',
    'calendar.txt': cal,
  },
  busMode,
);
const at7 = Date.parse('2026-11-18T07:00:00+08:00');

describe('buses and the daily snapshot', () => {
  it('cleans bus stop codes but keeps place names like SS15', () => {
    expect(bus.stops.map((s) => s.name)).toEqual(['Sra Seksyen 5', 'LRT Bangsar', 'SS15 Courtyard']);
    expect(stationName('KL1117 LRT BANGSAR')).toBe('LRT Bangsar');
    expect(bus.routes[0]).toMatchObject({ shortName: 'T117', mode: 'bus', color: '#0f766e' });
  });

  it('LRT then a feeder bus', () => {
    const net = buildNetwork([rail, bus]);
    const o = planTransit(net, { lat: 3.1, lng: 101.601 }, { lat: 3.2, lng: 101.751 }, at7)[0];
    expect(o.legs.map((l) => (l.type === 'walk' ? 'walk' : `${l.mode}:${l.shortName}`))).toEqual(['lrt:KJL', 'walk', 'bus:T117']);
  });

  it('a snapshot round-trip plans exactly the same trips', () => {
    const net = buildNetwork([rail, bus]);
    const bytes = serializeNetwork(net, ['rail', 'feeder']);
    const { net: back, feeds } = deserializeNetwork(bytes);
    expect(feeds).toEqual(['rail', 'feeder']);
    const sig = (n: typeof net) =>
      planTransit(n, { lat: 3.1, lng: 101.601 }, { lat: 3.2, lng: 101.751 }, at7).map((o) => o.legs.map((l) => (l.type === 'walk' ? 'w' : `${l.mode}${l.from.name}${l.depart}${l.arrive}`)).join('|'));
    expect(sig(back)).toEqual(sig(net));
    expect(back.stops.length).toBe(net.stops.length);
    expect(back.footpaths.flat().length).toBe(net.footpaths.flat().length);
  });
});
