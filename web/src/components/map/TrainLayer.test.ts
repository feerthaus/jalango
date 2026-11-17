import { describe, expect, it } from 'vitest';
import { trainFeatures } from './TrainLayer';
import type { TrainOption } from '@/services/transitService';

const st = (id: string, lat: number, lng: number) => ({ id, name: id, lat, lng });
const option = {
  leave: '', arrive: '', minutes: 200, transfers: 1, fareMin: 1, fareMax: 2, costMin: 1, costMax: 2,
  access: { type: 'ride', km: 4, minutes: 12, costMin: 8, costMax: 11 },
  egress: { type: 'walk', km: 1, minutes: 12, costMin: 0, costMax: 0 },
  legs: [
    { type: 'train', kind: 'komuter', color: '#dc2420', from: st('A', 3.1, 101.7), to: st('B', 3.6, 101.5), path: [[101.7, 3.1], [101.5, 3.6]] },
    { type: 'train', kind: 'ets', color: '#ffc72c', from: st('B', 3.6, 101.5), to: st('C', 4.6, 101.1), path: [[101.5, 3.6], [101.3, 4.0], [101.1, 4.6]] },
  ],
} as unknown as TrainOption;

describe('train on the map', () => {
  it('draws each leg in its colour, dashed access/egress, and each station once', () => {
    const fc = trainFeatures({ option, from: { lat: 3.15, lng: 101.71 }, to: { lat: 4.59, lng: 101.08 } });
    const kinds = fc.features.map((f) => f.properties.kind);
    expect(kinds.filter((k) => k === 'access')).toHaveLength(2);
    expect(fc.features.filter((f) => f.properties.kind === 'train').map((f) => f.properties.color)).toEqual(['#dc2420', '#ffc72c']);
    expect(fc.features.filter((f) => f.properties.kind === 'station').map((f) => f.properties.name)).toEqual(['A', 'B', 'C']);
    expect(fc.features[0].geometry).toEqual({ type: 'LineString', coordinates: [[101.71, 3.15], [101.7, 3.1]] });
  });
});
