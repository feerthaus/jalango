import type { Msg } from '@/lib/i18n';

export type QuickId = 'ok' | 'wait' | 'fuel' | 'food' | 'rest' | 'slow' | 'hazard' | 'arrived';

export interface QuickMeta {
  id: QuickId;
  emoji: string;
  label: Msg;
  /** sent with the sender's position, so everyone sees where */
  located: boolean;
}

/** One-tap calls, safe while driving (the order is the button order). */
export const QUICK: QuickMeta[] = [
  { id: 'ok', emoji: '👍', label: { ms: 'OK', en: 'OK' }, located: false },
  { id: 'fuel', emoji: '⛽', label: { ms: 'Singgah minyak', en: 'Fuel stop' }, located: true },
  { id: 'food', emoji: '🍽️', label: { ms: 'Singgah makan', en: 'Food stop' }, located: true },
  { id: 'rest', emoji: '🚻', label: { ms: 'Singgah R&R', en: 'R&R stop' }, located: true },
  { id: 'slow', emoji: '🐢', label: { ms: 'Perlahan sikit', en: 'Slow down a bit' }, located: false },
  { id: 'wait', emoji: '✋', label: { ms: 'Tunggu saya', en: 'Wait for me' }, located: false },
  { id: 'hazard', emoji: '⚠️', label: { ms: 'Ada bahaya', en: 'Hazard ahead' }, located: true },
  { id: 'arrived', emoji: '🏁', label: { ms: 'Dah sampai', en: 'Arrived' }, located: false },
];

export const quickMeta = (id: string | null | undefined) => QUICK.find((q) => q.id === id) ?? null;

/** Above this speed (~11 km/h) the driver gets the quick buttons only, unless they say they're a passenger. */
export const TYPING_MAX_MPS = 3;

export function canType(speedMps: number | null | undefined, passenger: boolean): boolean {
  return passenger || (speedMps ?? 0) <= TYPING_MAX_MPS;
}

/** What the voice says for an incoming message: "Ali: Singgah minyak". Long texts are cut. */
export function spokenMessage(name: string, body: string, quick: string | null, lang: 'ms' | 'en'): string {
  const q = quickMeta(quick);
  const text = q ? q.label[lang] : body.length > 120 ? `${body.slice(0, 117)}…` : body;
  return `${name}: ${text}`;
}

/** The text stored for a quick call, in the sender's language (others see it with the emoji). */
export function quickBody(id: QuickId, lang: 'ms' | 'en'): string {
  const q = quickMeta(id)!;
  return `${q.emoji} ${q.label[lang]}`;
}
