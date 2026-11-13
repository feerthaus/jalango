import type { RouteStep } from '@/types';

const MS_NUM = ['', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'lapan'];
const EN_NUM = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight'];

export type LaneSide = 'left' | 'right' | 'middle';

/** Which lanes to use, if it's a clear block: { count: 2, side: 'left' }. Null when all/none/scattered. */
export function lanePick(lanes: RouteStep['lanes']): { count: number; side: LaneSide } | null {
  if (!lanes || lanes.length < 2) return null;
  const idx = lanes.map((l, i) => (l.valid ? i : -1)).filter((i) => i >= 0);
  if (idx.length === 0 || idx.length === lanes.length) return null;
  const contiguous = idx[idx.length - 1] - idx[0] === idx.length - 1;
  if (!contiguous) return null;
  const side: LaneSide = idx[0] === 0 ? 'left' : idx[idx.length - 1] === lanes.length - 1 ? 'right' : 'middle';
  return { count: idx.length, side };
}

/**
 * "Guna 2 lorong kiri" for the screen, or "Guna dua lorong kiri" for the voice
 * (numbers in words). Null when there's nothing useful to say.
 */
export function laneSentence(lanes: RouteStep['lanes'], lang: 'ms' | 'en', spoken = false): string | null {
  const p = lanePick(lanes);
  if (!p) return null;
  const n = spoken ? (lang === 'ms' ? MS_NUM : EN_NUM)[p.count] ?? String(p.count) : String(p.count);
  if (lang === 'ms') {
    const side = p.side === 'left' ? 'kiri' : p.side === 'right' ? 'kanan' : 'tengah';
    if (p.count === 1) return p.side === 'middle' ? 'Guna lorong tengah' : `Guna lorong paling ${side}`;
    return `Guna ${n} lorong ${side}`;
  }
  const side = p.side;
  if (p.count === 1) return p.side === 'middle' ? 'Use the middle lane' : `Use the ${side} lane`;
  return p.side === 'middle' ? `Use the ${n} middle lanes` : `Use the ${n} ${side} lanes`;
}
