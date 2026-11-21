import { describe, expect, it } from 'vitest';
import type { RouteStep } from '@/types';
import { displayInstruction, maneuverPhrase, maneuverTarget, malayAction, shortInstruction, spokenDistance, stageThresholds, turnAtSignal } from './voiceInstructions';

const step = (maneuver: RouteStep['maneuver'], roadName?: string, instruction = ''): RouteStep => ({ instruction, distanceMeters: 0, durationSeconds: 0, maneuver, roadName });
const at = { lng: 101.7, lat: 3.1 };

describe('voice instructions', () => {
  it('speaks distances naturally', () => {
    expect(spokenDistance(287, 'ms')).toBe('300 meter');
    expect(spokenDistance(130, 'ms')).toBe('150 meter');
    expect(spokenDistance(40, 'en')).toBe('50 metres');
    expect(spokenDistance(1000, 'ms')).toBe('1 kilometer');
    expect(spokenDistance(1490, 'ms')).toBe('1 perpuluhan 5 kilometer');
    expect(spokenDistance(2100, 'en')).toBe('2 kilometres');
  });

  it('builds Malay maneuvers', () => {
    expect(malayAction(step({ type: 'turn', modifier: 'right', location: at }, 'Jalan Ampang'))).toBe('belok kanan ke Jalan Ampang');
    expect(malayAction(step({ type: 'turn', modifier: 'slight left', location: at }))).toBe('condong ke kiri');
    expect(malayAction(step({ type: 'turn', modifier: 'uturn', location: at }))).toBe('buat pusingan U');
    expect(malayAction(step({ type: 'roundabout', modifier: 'right', exit: 2, location: at }, 'Jalan Duta'))).toBe('di bulatan, ambil jalan keluar kedua ke Jalan Duta');
    expect(malayAction(step({ type: 'off ramp', modifier: 'slight left', location: at }, 'Lebuhraya Persekutuan'))).toBe('ambil susur keluar di sebelah kiri ke Lebuhraya Persekutuan');
    expect(malayAction(step({ type: 'fork', modifier: 'slight right', location: at }))).toBe('di simpang, ikut sebelah kanan');
  });

  it('builds full phrases per stage', () => {
    const s = step({ type: 'turn', modifier: 'left', location: at }, 'Jalan Tun Razak', 'Turn left onto Jalan Tun Razak.');
    expect(maneuverPhrase(s, 290, 'ms', 'near')).toBe('Dalam 300 meter, belok kiri ke Jalan Tun Razak');
    expect(maneuverPhrase(s, 50, 'ms', 'now')).toBe('Belok kiri ke Jalan Tun Razak');
    expect(maneuverPhrase(s, 900, 'en', 'far')).toBe('In 900 metres, turn left onto Jalan Tun Razak');
    expect(maneuverPhrase(step({ type: 'arrive', location: at }), 30, 'ms', 'now')).toBe('Anda telah sampai ke destinasi');
  });

  it('announces earlier at highway speed', () => {
    expect(stageThresholds(30).near).toBeGreaterThan(stageThresholds(10).near);
  });
});

describe('displayInstruction', () => {
  const step = (over: Partial<RouteStep>): RouteStep => ({ instruction: 'Take the ramp on the left towards Johor Bahru', distanceMeters: 100, durationSeconds: 10, maneuver: { type: 'off ramp', modifier: 'slight left', location: { lat: 0, lng: 0 } }, ...over });
  it('writes Malay with ramp destinations', () => {
    expect(displayInstruction(step({ roadRef: 'E2', destinations: 'Johor Bahru, Kuala Lumpur, Seremban' }), 'ms')).toBe('Ambil susur keluar di sebelah kiri ke E2 menghala Johor Bahru / Kuala Lumpur');
    expect(displayInstruction(step({ maneuver: { type: 'turn', modifier: 'left', location: { lat: 0, lng: 0 } }, roadName: "Jalan Dato' Haji Kosai" }), 'ms')).toBe("Belok kiri ke Jalan Dato' Haji Kosai");
    expect(displayInstruction(step({ maneuver: { type: 'arrive', location: { lat: 0, lng: 0 } } }), 'ms')).toBe('Sampai di destinasi');
  });
  it('names places, not road numbers, from Mapbox signposts', () => {
    expect(displayInstruction(step({ maneuver: { type: 'fork', modifier: 'slight left', location: { lat: 0, lng: 0 } }, roadRef: 'E37', destinations: 'E37, E2, E26: KLIA, Puchong, Putrajaya' }), 'ms')).toBe('Di simpang, ikut sebelah kiri ke E37 menghala KLIA / Puchong');
  });
  it('keeps the provider English text', () => {
    expect(displayInstruction(step({}), 'en')).toBe('Take the ramp on the left towards Johor Bahru');
  });
});

describe('shortInstruction', () => {
  const s = (type: string, modifier?: string, extra: Partial<RouteStep> = {}, exit?: number) =>
    ({ instruction: 'Turn left onto Jalan P. Ramlee.', distanceMeters: 0, durationSeconds: 0, maneuver: { type, modifier, exit, location: { lat: 0, lng: 0 } }, ...extra }) as RouteStep;
  it('keeps the banner to a few words', () => {
    expect(shortInstruction(s('turn', 'left'), 'ms')).toBe('Belok kiri');
    expect(shortInstruction(s('turn', 'right'), 'en')).toBe('Turn right');
    expect(shortInstruction(s('roundabout', 'right', {}, 2), 'ms')).toBe('Bulatan: keluar ke-2');
    expect(shortInstruction(s('fork', 'slight right'), 'ms')).toBe('Ikut kanan');
    expect(shortInstruction(s('off ramp', 'slight left'), 'ms')).toBe('Keluar kiri');
    expect(shortInstruction(s('turn', 'uturn'), 'ms')).toBe('Pusingan U');
  });
  it('puts the road (or the signposted places) on its own line', () => {
    expect(maneuverTarget(s('turn', 'left', { roadName: 'Jalan P. Ramlee' }))).toBe('Jalan P. Ramlee');
    expect(maneuverTarget(s('off ramp', 'left', { destinations: 'E6: Ipoh, Rawang' }))).toBe('Ipoh / Rawang');
    expect(maneuverTarget(s('turn', 'left'))).toBeNull();
    expect(maneuverTarget(s('fork', 'slight right', { roadRef: '142; M1' }))).toBe('142 / M1');
  });
});

describe('turns at traffic lights', () => {
  const at = (type: string, modifier?: string, atSignal = true) =>
    ({ instruction: 'Turn right onto Jalan Ampang.', distanceMeters: 0, durationSeconds: 0, maneuver: { type, modifier, location: { lat: 0, lng: 0 } }, roadName: 'Jalan Ampang', atSignal }) as RouteStep;
  it('names the lights, on screen and in speech', () => {
    expect(turnAtSignal(at('turn', 'right'))).toBe(true);
    expect(displayInstruction(at('turn', 'right'), 'ms')).toBe('Di lampu isyarat, belok kanan ke Jalan Ampang');
    expect(displayInstruction(at('turn', 'right'), 'en')).toBe('At the traffic lights, turn right onto Jalan Ampang');
    expect(maneuverPhrase(at('turn', 'right'), 300, 'ms', 'near')).toBe('Dalam 300 meter, di lampu isyarat, belok kanan ke Jalan Ampang');
  });
  it('leaves other maneuvers and unlit junctions alone', () => {
    expect(turnAtSignal(at('roundabout', 'right'))).toBe(false);
    expect(turnAtSignal(at('off ramp', 'slight left'))).toBe(false);
    expect(turnAtSignal(at('new name', 'straight'))).toBe(false);
    expect(displayInstruction(at('turn', 'right', false), 'ms')).toBe('Belok kanan ke Jalan Ampang');
    expect(displayInstruction(at('turn', 'right', false), 'en')).toBe('Turn right onto Jalan Ampang.');
  });
});
