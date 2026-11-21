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

type Dir = 'left' | 'right' | 'straight' | 'uturn';
const dirOf = (s: string): Dir | null => (s === 'uturn' ? 'uturn' : s.includes('left') ? 'left' : s.includes('right') ? 'right' : s === 'straight' ? 'straight' : null);

/**
 * The step's lanes, only if they agree with the turn. Mapbox's lane data is
 * sometimes for the wrong movement (e.g. "Belok kiri" with only the straight
 * lanes marked, Jalan Sultan Ismail → Jalan P. Ramlee): showing it would
 * send drivers into the wrong lane, so it's dropped (no lane guide is better).
 */
export function usableLanes(step: RouteStep): RouteStep['lanes'] {
  const lanes = step.lanes;
  if (!lanes || lanes.length < 2 || !lanes.some((l) => l.valid)) return undefined;
  const { type, modifier } = step.maneuver;
  if (type === 'arrive' || type === 'depart' || !modifier) return lanes;
  const turn = dirOf(modifier) ?? 'straight';
  // Bear/keep/ramps: a straight lane can be right for a slight turn
  const slight = modifier.startsWith('slight') || ['fork', 'off ramp', 'on ramp', 'merge'].includes(type);
  const fits = lanes.some(
    (l) =>
      l.valid &&
      (l.indications.length === 0 ||
        l.indications.some((i) => {
          if (i === 'none') return true; // unmarked lane: can't contradict
          const d = dirOf(i);
          return d === turn || (slight && d === 'straight') || (turn === 'straight' && i.startsWith('slight'));
        })),
  );
  return fits ? lanes : undefined;
}
