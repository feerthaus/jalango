/**
 * "Buka sekarang?" for a food business, in Malaysia time.
 * Supports closing after midnight (e.g. 18:00–02:00 for a night stall).
 */
export interface Hours {
  opens?: string;
  closes?: string;
  closed_days?: number[];
}

const mins = (hhmm: string) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

/** Day of week (0 = Sunday) and minutes since midnight in Malaysia (UTC+8). */
export function myNow(at: Date = new Date()): { day: number; min: number } {
  const t = new Date(at.getTime() + 8 * 3600_000);
  return { day: t.getUTCDay(), min: t.getUTCHours() * 60 + t.getUTCMinutes() };
}

/** null when hours are unknown. */
export function isOpenNow(h: Hours, at: Date = new Date()): boolean | null {
  const o = h.opens ? mins(h.opens) : null;
  const c = h.closes ? mins(h.closes) : null;
  if (o === null || c === null) return null;
  const { day, min } = myNow(at);
  const closed = new Set(h.closed_days ?? []);
  if (o === c) return !closed.has(day); // open all day
  if (o < c) return !closed.has(day) && min >= o && min < c;
  // past midnight: open from o today, or until c on the morning after an open day
  if (min >= o) return !closed.has(day);
  return min < c && !closed.has((day + 6) % 7);
}

/** "7:00 pg – 2:00 ptg" style, short. */
export function formatTime(hhmm: string): string {
  const m = mins(hhmm);
  if (m === null) return hhmm;
  const h = Math.floor(m / 60);
  const mm = String(m % 60).padStart(2, '0');
  const suffix = h < 12 ? 'pg' : h < 14 ? 'tgh' : h < 19 ? 'ptg' : 'mlm';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${mm} ${suffix}`;
}
