import { describe, expect, it } from 'vitest';
import type { RouteStep } from '@/types';
import { maneuverPhrase, malayAction, spokenDistance, stageThresholds } from './voiceInstructions';

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
