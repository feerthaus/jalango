import type { AccidentOutcome, AccidentVehicle } from '@/types';

export const VEHICLES: { id: AccidentVehicle; ms: string; en: string; emoji: string }[] = [
  { id: 'motorcycle', ms: 'Motosikal', en: 'Motorcycle', emoji: '🏍️' },
  { id: 'car', ms: 'Kereta', en: 'Car', emoji: '🚗' },
  { id: 'lorry', ms: 'Lori', en: 'Lorry', emoji: '🚚' },
  { id: 'bus', ms: 'Bas', en: 'Bus', emoji: '🚌' },
  { id: 'van', ms: 'Van', en: 'Van', emoji: '🚐' },
  { id: 'bicycle', ms: 'Basikal', en: 'Bicycle', emoji: '🚲' },
  { id: 'pedestrian', ms: 'Pejalan kaki', en: 'Pedestrian', emoji: '🚶' },
  { id: 'other', ms: 'Lain-lain', en: 'Other', emoji: '•' },
];

export const OUTCOMES: { id: AccidentOutcome; ms: string; en: string }[] = [
  { id: 'no_injury', ms: 'Tiada cedera', en: 'No injuries' },
  { id: 'injured', ms: 'Cedera', en: 'Injured' },
  { id: 'fatal', ms: 'Maut', en: 'Fatal' },
  { id: 'unknown', ms: 'Tidak pasti', en: 'Not sure' },
];

export const vehicleLabel = (v: AccidentVehicle, lang: 'ms' | 'en') => {
  const x = VEHICLES.find((o) => o.id === v);
  return x ? `${x.emoji} ${lang === 'en' ? x.en : x.ms}` : v;
};
export const outcomeLabel = (o: AccidentOutcome, lang: 'ms' | 'en') => {
  const x = OUTCOMES.find((v) => v.id === o);
  return x ? (lang === 'en' ? x.en : x.ms) : o;
};

/** "29 Okt 2026" — a calendar date, so formatted in UTC. */
export function formatDay(iso: string, lang: 'ms' | 'en'): string {
  try {
    return new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString(lang === 'en' ? 'en-MY' : 'ms-MY', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  } catch {
    return iso;
  }
}

/** Today in Malaysia, YYYY-MM-DD. */
export function todayMY(now = new Date()): string {
  return new Date(now.getTime() + 8 * 3600_000).toISOString().slice(0, 10);
}
