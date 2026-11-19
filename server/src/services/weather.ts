/**
 * MetMalaysia weather warnings (official, via data.gov.my): thunderstorms,
 * heavy/continuous rain and bad weather over land, with the states they
 * cover. Marine-only warnings and "no advisory" notices are left out.
 * Cached for 10 minutes.
 */
const URL_WARNINGS = 'https://api.data.gov.my/weather/warning';
const CACHE_MS = 10 * 60_000;
const TIMEOUT_MS = 8000;

export type StateCode = 'perlis' | 'kedah' | 'penang' | 'perak' | 'selangor' | 'kl' | 'putrajaya' | 'ns' | 'melaka' | 'johor' | 'pahang' | 'terengganu' | 'kelantan' | 'sabah' | 'sarawak' | 'labuan';

const STATES: [StateCode, RegExp][] = [
  ['perlis', /\bPerlis\b/i],
  ['kedah', /\bKedah\b/i],
  ['penang', /\bPulau Pinang\b|\bPenang\b/i],
  ['perak', /\bPerak\b/i],
  ['selangor', /\bSelangor\b/i],
  ['kl', /\bKuala Lumpur\b/i],
  ['putrajaya', /\bPutrajaya\b/i],
  ['ns', /\bNegeri Sembilan\b|\bN\. ?Sembilan\b/i],
  ['melaka', /\bMelaka\b|\bMalacca\b/i],
  ['johor', /\bJohor\b/i],
  ['pahang', /\bPahang\b/i],
  ['terengganu', /\bTerengganu\b/i],
  ['kelantan', /\bKelantan\b/i],
  ['sabah', /\bSabah\b/i],
  ['sarawak', /\bSarawak\b/i],
  ['labuan', /\bLabuan\b/i],
];

export type WarningKind = 'thunderstorm' | 'rain' | 'bad_weather';

export interface WeatherWarning {
  id: string;
  kind: WarningKind;
  title_bm: string;
  title_en: string;
  text_bm: string;
  text_en: string;
  issued: string;
  valid_from: string | null;
  valid_to: string | null;
  states: StateCode[];
}

interface RawWarning {
  warning_issue?: { issued?: string; title_bm?: string; title_en?: string };
  valid_from?: string | null;
  valid_to?: string | null;
  text_bm?: string | null;
  text_en?: string | null;
}

/** MetMalaysia times have no zone: they are Malaysia time. */
const myt = (s: string | null | undefined) => (s ? (/[zZ]|[+-]\d\d:\d\d$/.test(s) ? s : `${s}+08:00`) : null);

function kindOf(title: string): WarningKind | null {
  const t = title.toLowerCase();
  if (/laut|seas|siklon|cyclone|tiada|no advisory|gempa|earthquake|tsunami/.test(t)) return null;
  if (/ribut petir|thunderstorm/.test(t)) return 'thunderstorm';
  if (/hujan|rain/.test(t)) return 'rain';
  if (/cuaca buruk|bad weather|banjir|flood/.test(t)) return 'bad_weather';
  return null;
}

export function parseWarnings(raw: RawWarning[], now = Date.now()): WeatherWarning[] {
  const out: WeatherWarning[] = [];
  for (const w of raw) {
    const title_bm = w.warning_issue?.title_bm?.trim() ?? '';
    const title_en = w.warning_issue?.title_en?.trim() || title_bm;
    const kind = kindOf(`${title_bm} ${title_en}`);
    if (!kind) continue;
    const validTo = myt(w.valid_to);
    if (validTo && Date.parse(validTo) < now) continue; // over
    const text_bm = (w.text_bm ?? '').replace(/\s+/g, ' ').trim();
    const text_en = (w.text_en ?? '').replace(/\s+/g, ' ').trim() || text_bm;
    const states = STATES.filter(([, re]) => re.test(text_bm) || re.test(text_en)).map(([code]) => code);
    if (!states.length) continue;
    const issued = myt(w.warning_issue?.issued) ?? '';
    out.push({ id: `${issued}|${title_bm}|${validTo ?? ''}`, kind, title_bm, title_en, text_bm, text_en, issued, valid_from: myt(w.valid_from), valid_to: validTo, states });
  }
  return out;
}

let cache: { at: number; value: WeatherWarning[] } | null = null;

export async function getWeatherWarnings(): Promise<WeatherWarning[]> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.value.filter((w) => !w.valid_to || Date.parse(w.valid_to) >= Date.now());
  try {
    const res = await fetch(URL_WARNINGS, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const value = parseWarnings((await res.json()) as RawWarning[]);
    cache = { at: Date.now(), value };
    return value;
  } catch (err) {
    console.warn('[weather] warnings unavailable:', err instanceof Error ? err.message : err);
    return cache?.value ?? [];
  }
}

/** Tests only. */
export function resetWeatherCache(): void {
  cache = null;
}
