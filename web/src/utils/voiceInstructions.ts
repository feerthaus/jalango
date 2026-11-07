import type { RouteStep } from '@/types';

export type VoiceLang = 'ms' | 'en';
export type VoiceStage = 'far' | 'near' | 'now';

/** Spoken distance, rounded the way people say it. */
export function spokenDistance(m: number, lang: VoiceLang): string {
  if (m >= 950) {
    const km = Math.round(m / 500) / 2; // nearest 0.5 km
    const n = Number.isInteger(km) ? String(km) : km.toFixed(1).replace('.', lang === 'ms' ? ' perpuluhan ' : ' point ');
    return lang === 'ms' ? `${n} kilometer` : `${n} kilometre${km === 1 ? '' : 's'}`;
  }
  const r = m >= 300 ? Math.round(m / 100) * 100 : Math.max(50, Math.round(m / 50) * 50);
  return lang === 'ms' ? `${r} meter` : `${r} metres`;
}

const ORDINAL_MS = ['pertama', 'kedua', 'ketiga', 'keempat', 'kelima', 'keenam'];
const ORDINAL_EN = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth'];

/** First two signposted destinations of a ramp ("Johor Bahru, Kuala Lumpur"). */
function towards(step: RouteStep): string | null {
  if (!step.destinations) return null;
  const t = step.destinations.split(/[,;]/).map((s) => s.trim()).filter(Boolean).slice(0, 2);
  return t.length ? t.join(' / ') : null;
}

function road(step: RouteStep): string | null {
  if (step.roadRef && step.roadName) return `${step.roadName}`;
  return step.roadName ?? step.roadRef ?? null;
}

/** What to do at a maneuver, in Malay (generated from the maneuver, not the provider's English text). */
export function malayAction(step: RouteStep): string {
  const { type, modifier, exit } = step.maneuver;
  const side = modifier?.includes('left') ? 'kiri' : modifier?.includes('right') ? 'kanan' : null;
  const name = road(step);
  const toward = towards(step);
  const onto = (name ? ` ke ${name}` : '') + (toward ? ` menghala ${toward}` : '');

  if (type === 'arrive') return 'anda akan sampai ke destinasi';
  if (type === 'roundabout' || type === 'rotary' || type === 'roundabout turn') {
    const nth = exit ? ORDINAL_MS[exit - 1] ?? `ke-${exit}` : null;
    return nth ? `di bulatan, ambil jalan keluar ${nth}${onto}` : `masuk bulatan${onto}`;
  }
  if (type === 'off ramp') return `ambil susur keluar${side ? ` di sebelah ${side}` : ''}${onto}`;
  if (type === 'on ramp') return `masuk susur${side ? ` di sebelah ${side}` : ''}${onto}`;
  if (type === 'fork') return `di simpang, ikut sebelah ${side ?? 'kiri'}${onto}`;
  if (type === 'merge') return `masuk ke laluan${side ? ` sebelah ${side}` : ''}${onto}`;
  switch (modifier) {
    case 'uturn':
      return `buat pusingan U${onto}`;
    case 'sharp left':
    case 'sharp right':
      return `belok tajam ke ${side}${onto}`;
    case 'slight left':
    case 'slight right':
      return `condong ke ${side}${onto}`;
    case 'left':
    case 'right':
      return `belok ${side}${onto}`;
    default:
      return name ? `teruskan ke ${name}` : 'teruskan lurus';
  }
}

function englishAction(step: RouteStep): string {
  const { type, exit } = step.maneuver;
  if (type === 'arrive') return 'you will arrive at your destination';
  if ((type === 'roundabout' || type === 'rotary') && exit) {
    const name = road(step);
    return `at the roundabout, take the ${ORDINAL_EN[exit - 1] ?? `exit ${exit}`} exit${name ? ` onto ${name}` : ''}`;
  }
  // Provider text is already good English ("Turn right onto Jalan Ampang")
  const t = step.instruction.replace(/\.$/, '');
  return t ? t.charAt(0).toLowerCase() + t.slice(1) : 'continue';
}

/**
 * The sentence to speak for the upcoming maneuver.
 *  far / near: "Dalam 300 meter, belok kanan ke Jalan Ampang"
 *  now:        "Belok kanan ke Jalan Ampang"
 */
export function maneuverPhrase(step: RouteStep, distanceM: number, lang: VoiceLang, stage: VoiceStage): string {
  const action = lang === 'ms' ? malayAction(step) : englishAction(step);
  if (stage === 'now' || step.maneuver.type === 'arrive' && distanceM < 60) {
    if (step.maneuver.type === 'arrive') return lang === 'ms' ? 'Anda telah sampai ke destinasi' : 'You have arrived at your destination';
    return capitalise(action);
  }
  const d = spokenDistance(distanceM, lang);
  return lang === 'ms' ? `Dalam ${d}, ${action}` : `In ${d}, ${action}`;
}

export const PHRASES = {
  start: { ms: 'Memulakan navigasi.', en: 'Starting navigation.' },
  reroute: { ms: 'Mengira semula laluan.', en: 'Recalculating route.' },
  arrived: { ms: 'Anda telah sampai ke destinasi.', en: 'You have arrived at your destination.' },
} as const;

/** Distances at which to announce, scaled up at highway speed. */
export function stageThresholds(speedMps: number | null): Record<VoiceStage, number> {
  const fast = (speedMps ?? 0) > 20; // ~72 km/h
  return fast ? { far: 2000, near: 600, now: 120 } : { far: 1000, near: 300, now: 60 };
}

/** Instruction text for the screen: Malay generated from the maneuver, or the provider's English. */
export function displayInstruction(step: RouteStep, lang: VoiceLang): string {
  if (lang === 'en') return step.instruction || capitalise(englishAction(step));
  if (step.maneuver.type === 'arrive') return 'Sampai di destinasi';
  if (step.maneuver.type === 'depart') return road(step) ? `Mula di ${road(step)}` : 'Mula perjalanan';
  return capitalise(malayAction(step));
}

function capitalise(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
