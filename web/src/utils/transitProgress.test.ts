import { describe, expect, it } from 'vitest';
import type { TransitLeg, TransitOption } from '@/services/transitService';
import { advanceTrip, startProgress, tripSteps } from './transitProgress';

// LRT: 4 stops north along a line (A0 → A4), change on foot, MRT 2 stops east (B0 → B2)
const T = (hhmm: string) => `2026-11-19T${hhmm}:00+08:00`;
const ms = (hhmm: string) => Date.parse(T(hhmm));
const st = (id: string, lat: number, lng: number) => ({ id, name: id, lat, lng });
const lrtPath: [number, number][] = [0, 1, 2, 3, 4].map((i) => [101.6, 3.0 + i * 0.01]);
const mrtPath: [number, number][] = [0, 1, 2].map((i) => [101.61 + i * 0.01, 3.04]);
const leg = (o: Partial<TransitLeg> & Pick<TransitLeg, 'from' | 'to' | 'depart' | 'arrive' | 'path'>): TransitLeg => ({
  type: 'transit', mode: 'lrt', routeName: 'Line', shortName: 'X', color: '#f00', tripId: 't', tripKey: 'k', stops: o.path.length - 1, km: 5,
  fareMin: 1, fareMax: 2, fareShared: false, ticket: false, ...o,
});
const lrt = leg({ from: st('A0', 3.0, 101.6), to: st('A4', 3.04, 101.6), depart: T('09:00'), arrive: T('09:12'), path: lrtPath });
const mrt = leg({ mode: 'mrt', from: st('B0', 3.04, 101.61), to: st('B2', 3.04, 101.63), depart: T('09:16'), arrive: T('09:22'), path: mrtPath });
const option: TransitOption = {
  leave: T('08:50'), arrive: T('09:30'), minutes: 40, transfers: 1,
  access: { type: 'walk', km: 0.5, minutes: 7, costMin: 0, costMax: 0 },
  legs: [lrt, { type: 'walk', from: lrt.to, to: mrt.from, minutes: 2, km: 0.15 }, mrt],
  egress: { type: 'walk', km: 0.5, minutes: 7, costMin: 0, costMax: 0 },
  fareMin: 2, fareMax: 3, costMin: 2, costMax: 3, modes: ['lrt', 'mrt'],
};
const dest = { lat: 3.04, lng: 101.635 };
const at = (lat: number, lng: number, accuracy = 10) => ({ coordinates: { lat, lng }, accuracy });

describe('tripSteps', () => {
  it('walk to the station, ride, change, ride, walk to the destination', () => {
    expect(tripSteps(option).map((s) => s.kind)).toEqual(['access', 'ride', 'walk', 'ride', 'egress']);
  });
});

describe('advanceTrip', () => {
  const steps = tripSteps(option);

  it('stays on "walk to the station" until the train has left it', () => {
    const r = advanceTrip(steps, startProgress(), at(2.999, 101.6), ms('08:55'), dest);
    expect(r.progress.step).toBe(0);
  });

  it('GPS on the line past the first stop: riding, with stops left', () => {
    const r = advanceTrip(steps, startProgress(), at(3.01, 101.6), ms('09:03'), dest);
    expect(r.progress.step).toBe(1);
    expect(r.byGps).toBe(true);
    expect(r.stopsLeft).toBe(3);
    expect(r.alert).toBeNull();
  });

  it('rings once, one stop before getting off (GPS)', () => {
    let p = advanceTrip(steps, startProgress(), at(3.01, 101.6), ms('09:03'), dest).progress;
    const r = advanceTrip(steps, p, at(3.03, 101.6), ms('09:09'), dest);
    expect(r.alert).toBe(1);
    expect(r.stopsLeft).toBe(1);
    p = r.progress;
    expect(advanceTrip(steps, p, at(3.031, 101.6), ms('09:10'), dest).alert).toBeNull();
  });

  it('in a tunnel (no GPS) uses the timetable, and still rings before the stop', () => {
    let r = advanceTrip(steps, startProgress(), null, ms('09:02'), dest);
    expect(r.progress.step).toBe(1);
    expect(r.byGps).toBe(false);
    r = advanceTrip(steps, r.progress, null, ms('09:06'), dest);
    expect(r.alert).toBeNull();
    r = advanceTrip(steps, r.progress, null, ms('09:09') + 30_000, dest);
    expect(r.alert).toBe(1);
  });

  it('weak GPS (big accuracy circle) counts as no GPS', () => {
    const r = advanceTrip(steps, startProgress(), at(3.03, 101.6, 900), ms('09:03'), dest);
    expect(r.byGps).toBe(false);
  });

  it('moves on to the change, then rings before the MRT stop', () => {
    let r = advanceTrip(steps, { step: 1, alerted: [1], done: false }, at(3.04, 101.6), ms('09:12'), dest);
    expect(r.progress.step).toBe(2); // walking to change lines
    r = advanceTrip(steps, r.progress, at(3.04, 101.62), ms('09:19'), dest);
    expect(r.progress.step).toBe(3);
    expect(r.alert).toBe(3); // 1 stop left on a 2-stop ride
  });

  it('jumps ahead when GPS shows a later ride (caught an earlier train)', () => {
    const r = advanceTrip(steps, startProgress(), at(3.04, 101.62), ms('09:10'), dest);
    expect(r.progress.step).toBe(3);
  });

  it('finishes at the destination', () => {
    const r = advanceTrip(steps, { step: 4, alerted: [1, 3], done: false }, at(3.04, 101.635), ms('09:29'), dest);
    expect(r.progress.done).toBe(true);
  });

  it('never rings for a stop already passed when the app was closed', () => {
    const r = advanceTrip(steps, { step: 1, alerted: [], done: false }, null, ms('09:14'), dest);
    expect(r.progress.step).toBe(2);
    expect(r.alert).toBeNull();
  });
});
