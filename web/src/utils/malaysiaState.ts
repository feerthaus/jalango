import type { Coordinates } from '@/types';
import { haversineMeters } from './geo';

/**
 * Which Malaysian state a point is in, offline: the state of the nearest of
 * ~120 towns (state and district centres). Good enough to match weather
 * warnings; can be off right at a state border. Null outside Malaysia.
 */
export type StateCode = 'perlis' | 'kedah' | 'penang' | 'perak' | 'selangor' | 'kl' | 'putrajaya' | 'ns' | 'melaka' | 'johor' | 'pahang' | 'terengganu' | 'kelantan' | 'sabah' | 'sarawak' | 'labuan';

export const STATE_NAMES: Record<StateCode, string> = {
  perlis: 'Perlis', kedah: 'Kedah', penang: 'Pulau Pinang', perak: 'Perak', selangor: 'Selangor', kl: 'Kuala Lumpur', putrajaya: 'Putrajaya',
  ns: 'Negeri Sembilan', melaka: 'Melaka', johor: 'Johor', pahang: 'Pahang', terengganu: 'Terengganu', kelantan: 'Kelantan', sabah: 'Sabah', sarawak: 'Sarawak', labuan: 'Labuan',
};

// [state, lat, lng]
const TOWNS: [StateCode, number, number][] = [
  ['perlis', 6.44, 100.2], ['perlis', 6.66, 100.32],
  ['kedah', 6.12, 100.37], ['kedah', 5.65, 100.49], ['kedah', 5.37, 100.56], ['kedah', 5.68, 100.92], ['kedah', 6.35, 99.8], ['kedah', 6.35, 100.48], ['kedah', 5.93, 100.8], ['kedah', 6.0, 100.4],
  ['penang', 5.41, 100.33], ['penang', 5.4, 100.37], ['penang', 5.36, 100.46], ['penang', 5.3, 100.27], ['penang', 5.23, 100.48], ['penang', 5.5, 100.43],
  ['perak', 4.6, 101.08], ['perak', 4.85, 100.74], ['perak', 4.03, 101.02], ['perak', 4.22, 100.7], ['perak', 5.44, 101.13], ['perak', 3.68, 101.52], ['perak', 4.77, 100.94], ['perak', 4.3, 101.15], ['perak', 3.97, 101.28], ['perak', 5.1, 100.6], ['perak', 4.48, 100.95], ['perak', 3.83, 100.98],
  ['selangor', 3.07, 101.52], ['selangor', 3.04, 101.45], ['selangor', 3.11, 101.61], ['selangor', 3.32, 101.58], ['selangor', 2.99, 101.79], ['selangor', 3.34, 101.25], ['selangor', 2.69, 101.75],
  ['selangor', 2.81, 101.5], ['selangor', 3.56, 101.66], ['selangor', 3.68, 100.98], ['selangor', 3.15, 101.77], ['selangor', 3.05, 101.58], ['selangor', 3.02, 101.62], ['selangor', 3.25, 101.7], ['selangor', 2.93, 101.75], ['selangor', 3.22, 101.55],
  ['kl', 3.14, 101.69], ['kl', 3.08, 101.72], ['kl', 3.21, 101.64], ['kl', 3.19, 101.72], ['kl', 3.12, 101.66], ['kl', 3.1, 101.68],
  ['putrajaya', 2.93, 101.69], ['putrajaya', 2.9, 101.67],
  ['ns', 2.73, 101.94], ['ns', 2.52, 101.8], ['ns', 2.74, 102.25], ['ns', 2.47, 102.23], ['ns', 2.81, 102.4], ['ns', 2.81, 101.8], ['ns', 2.91, 102.0], ['ns', 2.6, 101.97],
  ['melaka', 2.19, 102.25], ['melaka', 2.38, 102.21], ['melaka', 2.31, 102.43], ['melaka', 2.27, 102.12],
  ['johor', 1.49, 103.74], ['johor', 1.85, 102.93], ['johor', 2.04, 102.57], ['johor', 2.03, 103.32], ['johor', 2.51, 102.82], ['johor', 2.43, 103.84], ['johor', 1.73, 103.9], ['johor', 1.49, 103.39], ['johor', 1.66, 103.6], ['johor', 2.17, 102.85], ['johor', 1.44, 103.57], ['johor', 1.55, 104.2],
  ['pahang', 3.81, 103.33], ['pahang', 3.45, 102.42], ['pahang', 3.52, 101.91], ['pahang', 3.79, 101.86], ['pahang', 3.94, 102.36], ['pahang', 4.18, 102.05], ['pahang', 4.47, 101.38], ['pahang', 3.49, 103.39], ['pahang', 2.8, 103.48], ['pahang', 3.59, 102.77], ['pahang', 3.42, 101.79], ['pahang', 4.12, 103.0], ['pahang', 2.97, 102.97],
  ['terengganu', 5.33, 103.14], ['terengganu', 4.23, 103.42], ['terengganu', 4.76, 103.42], ['terengganu', 5.83, 102.56], ['terengganu', 5.21, 103.21], ['terengganu', 5.52, 102.74], ['terengganu', 5.07, 103.01], ['terengganu', 4.55, 103.0],
  ['kelantan', 6.13, 102.24], ['kelantan', 5.8, 102.15], ['kelantan', 5.77, 102.22], ['kelantan', 6.05, 102.14], ['kelantan', 5.53, 102.2], ['kelantan', 4.88, 101.97], ['kelantan', 5.83, 102.4], ['kelantan', 5.7, 101.84], ['kelantan', 6.07, 102.06],
  ['sabah', 5.98, 116.07], ['sabah', 5.84, 118.12], ['sabah', 4.24, 117.89], ['sabah', 5.03, 118.33], ['sabah', 5.34, 116.16], ['sabah', 6.88, 116.85], ['sabah', 5.35, 115.75], ['sabah', 5.95, 116.68], ['sabah', 4.48, 118.61], ['sabah', 4.75, 115.98], ['sabah', 5.53, 117.47],
  ['sarawak', 1.55, 110.34], ['sarawak', 2.29, 111.83], ['sarawak', 4.4, 113.99], ['sarawak', 3.17, 113.04], ['sarawak', 1.24, 111.46], ['sarawak', 2.02, 112.93], ['sarawak', 4.75, 115.01], ['sarawak', 2.13, 111.52], ['sarawak', 2.9, 112.09], ['sarawak', 1.39, 110.33], ['sarawak', 3.2, 114.2], ['sarawak', 1.8, 111.0],
  ['labuan', 5.28, 115.24],
];

export function stateAt(p: Coordinates): StateCode | null {
  let best: StateCode | null = null;
  let bestM = Infinity;
  for (const [s, lat, lng] of TOWNS) {
    const m = haversineMeters(p, { lat, lng });
    if (m < bestM) {
      bestM = m;
      best = s;
    }
  }
  return bestM < 90_000 ? best : null;
}
