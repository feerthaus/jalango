import type { TollPayment } from '@/lib/tollPayment';
import type { TollPoint } from '@/types';
import { projectOnRoute, type RouteIndex } from './routeProgress';

export interface TollOnRoute {
  toll: TollPoint;
  along: number;
}

/** Toll plazas / gantries on the route, in driving order (deduplicated within 300 m). */
export function tollsOnRoute(index: RouteIndex, points: TollPoint[] | undefined, maxOffset = 60): TollOnRoute[] {
  const out: TollOnRoute[] = [];
  for (const t of points ?? []) {
    const p = projectOnRoute(index, t.location);
    if (p.offset > maxOffset) continue;
    if (out.some((o) => Math.abs(o.along - p.along) < 300)) continue;
    out.push({ toll: t, along: p.along });
  }
  return out.sort((a, b) => a.along - b.along);
}

/** "Plaza Tol Sungai Besi" / "Plaza tol" / "Gantri tol" for the screen. */
export function tollTitle(t: TollPoint, lang: 'ms' | 'en'): string {
  if (t.name) return t.name;
  if (t.type === 'gantry') return lang === 'ms' ? 'Gantri tol' : 'Toll gantry';
  return lang === 'ms' ? 'Plaza tol' : 'Toll plaza';
}

/** Short tip for how to pass, based on the driver's payment method. */
export function tollTip(t: TollPoint, pay: TollPayment | null, lang: 'ms' | 'en'): string {
  if (t.type === 'gantry') {
    return lang === 'ms' ? 'Tol dikutip tanpa berhenti. Pastikan tag atau RFID anda aktif.' : 'Collected without stopping. Make sure your tag or RFID is active.';
  }
  const ms: Record<TollPayment, string> = {
    rfid: 'Guna lorong RFID. Pastikan baki mencukupi.',
    tng: "Sediakan kad Touch 'n Go dan guna lorong TnG.",
    smarttag: 'Guna lorong SmartTAG dan pastikan kad dimasukkan.',
    card: 'Guna lorong yang menerima kad debit/kredit.',
  };
  const en: Record<TollPayment, string> = {
    rfid: 'Use the RFID lanes. Check your balance.',
    tng: "Have your Touch 'n Go card ready and use the TnG lanes.",
    smarttag: 'Use the SmartTAG lanes with the card inserted.',
    card: 'Use a lane that accepts debit/credit cards.',
  };
  if (!pay) return lang === 'ms' ? 'Sediakan bayaran tol.' : 'Have your toll payment ready.';
  return (lang === 'ms' ? ms : en)[pay];
}

/** Spoken: "Plaza tol Sungai Besi dalam 1 kilometer. Guna lorong RFID…" */
export function tollPhrase(t: TollPoint, pay: TollPayment | null, distanceText: string, lang: 'ms' | 'en'): string {
  const title = tollTitle(t, lang);
  return lang === 'ms' ? `${title} dalam ${distanceText}. ${tollTip(t, pay, lang)}` : `${title} in ${distanceText}. ${tollTip(t, pay, lang)}`;
}
