/**
 * Ticket partners (affiliate links). Phase 1 of train tickets links to KTMB's
 * own site; a partner link is added next to it once the owner's affiliate ID
 * is set (VITE_TWELVEGO_ID in Netlify). The official KTMB button always stays.
 */
export const TWELVEGO_ID = ((import.meta.env.VITE_TWELVEGO_ID as string | undefined) ?? '').trim().replace(/[^0-9A-Za-z_-]/g, '');

/** KTMB station (GTFS name) → 12Go city page. Stations not listed fall back to 12Go's KTM page. */
const CITY: Record<string, string> = {
  'kl sentral': 'kuala-lumpur',
  'kuala lumpur': 'kuala-lumpur',
  'bandar tasek selatan': 'kuala-lumpur',
  ipoh: 'ipoh',
  butterworth: 'butterworth',
  'jb sentral': 'johor-bahru',
  'padang besar': 'padang-besar',
  'alor setar': 'alor-setar',
  'sungai petani': 'sungai-petani',
  taiping: 'taiping',
  'kuala kangsar': 'kuala-kangsar',
  kampar: 'kampar',
  seremban: 'seremban',
  gemas: 'gemas',
  segamat: 'segamat',
  kluang: 'kluang',
  'wakaf bharu': 'kota-bharu',
  woodlands: 'singapore',
};

export const twelveGoCity = (station: string) => CITY[station.trim().toLowerCase()] ?? null;

/** 12Go page for a KTMB trip, with our affiliate ID; null when no ID is set. */
export function twelveGoTrainUrl(fromStation: string, toStation: string, lang: 'ms' | 'en' = 'en'): string | null {
  if (!TWELVEGO_ID) return null;
  const a = twelveGoCity(fromStation);
  const b = twelveGoCity(toStation);
  const locale = lang === 'ms' ? 'ms' : 'en';
  const path = a && b && a !== b ? `/${locale}/travel/${a}/${b}` : `/${locale}/operator/ktm`;
  return `https://12go.asia${path}?z=${encodeURIComponent(TWELVEGO_ID)}`;
}
