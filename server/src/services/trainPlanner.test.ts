import { describe, expect, it } from 'vitest';
import { buildTimetable, parseCsv, titleCase } from './ktmb.js';
import { accessLeg, estimateFare, mytMidnight, planTrainTrips, serviceRuns } from './trainPlanner.js';

// A tiny line: KL Sentral — Tanjong Malim — Ipoh — Butterworth, plus a branch at Ipoh
const files = {
  'stops.txt': `stop_id,stop_name,stop_lat,stop_lon
KLS,KL SENTRAL,3.1343,101.6865
TMM,TANJONG MALIM,3.6851,101.5185
IPH,IPOH,4.5975,101.0901
BWH,BUTTERWORTH,5.3949,100.3657
TPG,TAIPING,4.8510,100.7360`,
  'routes.txt': `agency_id,route_id,route_type,route_short_name,route_long_name,route_color
ktmb,ETS,2,ETS,Electric Train Service,FFC72C
ktmb,KOM,0,Komuter,"KTM Komuter, Utara",1964B7`,
  'trips.txt': `route_id,service_id,trip_id
ETS,ets,E1
ETS,ets,E2
KOM,kom_weekday,K1
ETS,ets_sat,E3`,
  'stop_times.txt': `trip_id,arrival_time,departure_time,stop_id,stop_sequence,shape_dist_traveled
E1,09:00:00,09:00:00,KLS,1,0
E1,10:00:00,10:02:00,TMM,2,80
E1,11:30:00,11:32:00,IPH,3,206
E2,14:00:00,14:00:00,KLS,1,0
E2,16:30:00,16:32:00,IPH,2,206
E2,19:15:00,19:15:00,BWH,3,388
K1,12:00:00,12:00:00,IPH,1,0
K1,13:00:00,13:00:00,TPG,2,85
E3,08:00:00,08:00:00,KLS,1,0
E3,10:30:00,10:30:00,IPH,2,206`,
  'calendar.txt': `service_id,monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date
ets,1,1,1,1,1,1,1,20261101,20261231
kom_weekday,1,1,1,1,1,0,0,20261101,20261231
ets_sat,0,0,0,0,0,1,0,20261101,20261231`,
  'calendar_dates.txt': `service_id,date,exception_type
ets,20261118,2`,
};
const tt = buildTimetable(files);
const KLCC = { lat: 3.1579, lng: 101.7116 };
const IPOH_TOWN = { lat: 4.5975, lng: 101.0801 };
const TAIPING_TOWN = { lat: 4.85, lng: 100.74 };
const tue8am = Date.parse('2026-11-17T08:00:00+08:00');

describe('KTMB timetable', () => {
  it('parses quoted CSV and tidies station names', () => {
    expect(parseCsv('a,b\n"x, y",2\r\n')).toEqual([{ a: 'x, y', b: '2' }]);
    expect(titleCase('KL SENTRAL')).toBe('KL Sentral');
    expect(titleCase('BDR TASEK SELATAN')).toBe('Bandar Tasek Selatan');
    expect(tt.stops.get('IPH')?.name).toBe('Ipoh');
    expect(tt.routes.get('KOM')?.longName).toBe('KTM Komuter, Utara');
  });

  it('knows which days a service runs (calendar + exceptions)', () => {
    expect(serviceRuns(tt, 'ets', mytMidnight(tue8am))).toBe(true);
    expect(serviceRuns(tt, 'ets', mytMidnight(tue8am) + 86_400_000)).toBe(false); // removed on 18 Nov
    expect(serviceRuns(tt, 'ets_sat', mytMidnight(tue8am))).toBe(false);
  });
});

describe('train planner', () => {
  it('finds direct ETS trains, with the ride to the station and an estimated fare', () => {
    const opts = planTrainTrips(tt, KLCC, IPOH_TOWN, tue8am);
    expect(opts.map((o) => o.legs[0].tripId)).toEqual(['E1', 'E2']);
    const o = opts[0];
    expect(o.legs[0]).toMatchObject({ kind: 'ets', from: { name: 'KL Sentral' }, to: { name: 'Ipoh' }, km: 206, ticket: true, depart: '2026-11-17T09:00:00+08:00', arrive: '2026-11-17T11:30:00+08:00' });
    expect(o.access.type).toBe('ride');
    expect(o.egress.type).toBe('walk');
    expect(o.legs[0].path).toHaveLength(3);
    // leave home in time: ride + 10 min at the platform
    expect(Date.parse(o.leave)).toBe(Date.parse('2026-11-17T09:00:00+08:00') - (o.access.minutes + 10) * 60_000);
    expect(o.fareMin).toBeGreaterThan(20);
    expect(o.costMax).toBeGreaterThanOrEqual(o.fareMax + o.access.costMax);
  });

  it('changes trains once (ETS then Komuter), with time to change', () => {
    const opts = planTrainTrips(tt, KLCC, TAIPING_TOWN, tue8am);
    expect(opts).toHaveLength(1);
    expect(opts[0].transfers).toBe(1);
    expect(opts[0].legs.map((l) => `${l.tripId}:${l.from.name}>${l.to.name}`)).toEqual(['E1:KL Sentral>Ipoh', 'K1:Ipoh>Taiping']);
    expect(opts[0].legs[1]).toMatchObject({ kind: 'komuter', ticket: false });
  });

  it('skips trains already gone, and days the service does not run', () => {
    expect(planTrainTrips(tt, KLCC, IPOH_TOWN, Date.parse('2026-11-17T13:00:00+08:00')).map((o) => o.legs[0].tripId)).toEqual(['E2']);
    // 18 Nov: ETS removed by calendar_dates; 19 Nov morning still has E1
    const wed = planTrainTrips(tt, KLCC, IPOH_TOWN, Date.parse('2026-11-18T06:00:00+08:00'));
    expect(wed.every((o) => o.leave.startsWith('2026-11-19'))).toBe(true);
  });

  it('nothing for short trips or places far from any station', () => {
    expect(planTrainTrips(tt, KLCC, { lat: 3.14, lng: 101.69 }, tue8am)).toEqual([]);
    expect(planTrainTrips(tt, KLCC, { lat: 1.5, lng: 110.3 }, tue8am)).toEqual([]); // Kuching
  });

  it('access legs and fare estimates', () => {
    expect(accessLeg(0.5)).toMatchObject({ type: 'walk', costMin: 0, costMax: 0 });
    expect(accessLeg(10)).toMatchObject({ type: 'ride' });
    expect(estimateFare('shuttle', 4)).toEqual({ min: 5, max: 5 });
    const ets = estimateFare('ets', 388);
    expect(ets.min).toBeLessThan(ets.max);
    expect(estimateFare('komuter', 10).max).toBeLessThan(5);
  });
});
