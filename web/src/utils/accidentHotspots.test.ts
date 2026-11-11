import { describe, expect, it } from 'vitest';
import type { AccidentRecord, Route } from '@/types';
import { clusterAccidents, hotspotPhrase, hotspotsOnRoute } from './accidentHotspots';
import { buildRouteIndex } from './routeProgress';

let n = 0;
const rec = (lat: number, lng: number, occurred_on: string, over: Partial<AccidentRecord> = {}): AccidentRecord => ({
  id: `r${n++}`, user_id: 'u', latitude: lat, longitude: lng, occurred_on, time_of_day: 'day', vehicles: ['car'], outcome: 'injured', note: null,
  source: 'user', photo_path: null, photo_status: 'none', upvotes: 0, downvotes: 0, created_at: '2026-11-01T00:00:00Z', ...over,
});

// Simpang Taman Seri Dagang (approx.) — six crashes within ~60 m, plus one 2 km away
const J = { lat: 2.95, lng: 101.45 };
const records = [
  rec(J.lat, J.lng, '2026-07-01'), rec(J.lat + 0.0003, J.lng, '2026-08-05'), rec(J.lat, J.lng + 0.0004, '2026-10-11'),
  rec(J.lat - 0.0002, J.lng, '2026-10-28'), rec(J.lat, J.lng - 0.0003, '2026-10-29', { outcome: 'fatal' }), rec(J.lat + 0.0001, J.lng + 0.0001, '2026-11-11'),
  rec(J.lat + 0.018, J.lng, '2026-09-01'),
];

describe('accident hotspots', () => {
  it('groups nearby records into one spot, newest first', () => {
    const spots = clusterAccidents(records);
    expect(spots.map((s) => s.count)).toEqual([6, 1]);
    expect(spots[0].lastDate).toBe('2026-11-11');
    expect(spots[0].firstDate).toBe('2026-07-01');
    expect(spots[0].fatal).toBe(1);
  });
  it('finds black spots on the route, not single records or off-route spots', () => {
    const route = { geometry: { type: 'LineString', coordinates: [[101.45, 2.94], [101.45, 2.98]] }, steps: [] } as unknown as Route;
    const on = hotspotsOnRoute(buildRouteIndex(route), clusterAccidents(records));
    expect(on).toHaveLength(1);
    expect(on[0].spot.count).toBe(6);
    const elsewhere = { geometry: { type: 'LineString', coordinates: [[101.5, 2.94], [101.5, 2.98]] }, steps: [] } as unknown as Route;
    expect(hotspotsOnRoute(buildRouteIndex(elsewhere), clusterAccidents(records))).toHaveLength(0);
  });
  it('says how many crashes and deaths', () => {
    expect(hotspotPhrase(clusterAccidents(records)[0], 'ms')).toBe('Awas, kawasan kerap kemalangan di hadapan. 6 kemalangan direkodkan, 1 maut. Pandu berhati-hati.');
  });
});
