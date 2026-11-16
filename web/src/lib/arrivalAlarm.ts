/**
 * Beep, vibrate and keep the screen on for someone waiting on a live-location
 * link. Browsers only allow sound after a tap, so `arm()` must run inside the
 * click handler of the "Beritahu saya bila sampai" button. Nothing here uses the
 * network.
 */
type AudioCtor = typeof AudioContext;
type WakeLockSentinelLike = { release: () => Promise<void>; released?: boolean };
type NavigatorExtra = Navigator & { wakeLock?: { request: (t: 'screen') => Promise<WakeLockSentinelLike> }; vibrate?: (p: number | number[]) => boolean };

let ctx: AudioContext | null = null;
let ringing: number | null = null;
let ringStop: number | null = null;
let lock: WakeLockSentinelLike | null = null;
let wantLock = false;

function audio(): AudioContext | null {
  if (ctx) return ctx;
  const C = (window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioCtor }).webkitAudioContext) as AudioCtor | undefined;
  if (!C) return null;
  ctx = new C();
  return ctx;
}

function tone(at: number, freq: number, length: number, gain = 0.35) {
  const c = audio();
  if (!c) return;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(gain, at + 0.02);
  g.gain.setValueAtTime(gain, at + length - 0.05);
  g.gain.linearRampToValueAtTime(0, at + length);
  osc.connect(g).connect(c.destination);
  osc.start(at);
  osc.stop(at + length + 0.02);
}

/** Three rising beeps. */
function beepBurst() {
  const c = audio();
  if (!c) return;
  const t = c.currentTime + 0.05;
  tone(t, 880, 0.18);
  tone(t + 0.28, 988, 0.18);
  tone(t + 0.56, 1175, 0.32);
}

async function requestLock() {
  const nav = navigator as NavigatorExtra;
  if (!wantLock || !nav.wakeLock || document.visibilityState !== 'visible') return;
  try {
    if (!lock || lock.released) lock = await nav.wakeLock.request('screen');
  } catch {
    /* not allowed (e.g. battery saver): the page still works, the screen may sleep */
  }
}
// A wake lock is dropped when the tab is hidden; take it again on return
function onVisible() {
  void requestLock();
}

/** Call from the button's click: unlocks sound (with one soft beep) and keeps the screen on. */
export async function arm(): Promise<{ sound: boolean; wakeLock: boolean; vibrate: boolean }> {
  const c = audio();
  if (c && c.state !== 'running') await c.resume().catch(() => undefined);
  if (c) tone(c.currentTime + 0.02, 660, 0.12, 0.2); // "it works"
  wantLock = true;
  document.addEventListener('visibilitychange', onVisible);
  await requestLock();
  const nav = navigator as NavigatorExtra;
  return { sound: c?.state === 'running', wakeLock: Boolean(lock && !lock.released), vibrate: typeof nav.vibrate === 'function' };
}

/** Stop listening, release the screen. */
export function disarm(): void {
  stopRinging();
  wantLock = false;
  document.removeEventListener('visibilitychange', onVisible);
  void lock?.release().catch(() => undefined);
  lock = null;
}

/** Ring: beep bursts + vibration every 2.5 s, for up to `maxMs` or until stopRinging(). */
export function ring(maxMs = 30_000): void {
  stopRinging();
  const once = () => {
    beepBurst();
    (navigator as NavigatorExtra).vibrate?.([400, 150, 400, 150, 600]);
  };
  once();
  ringing = window.setInterval(once, 2500);
  ringStop = window.setTimeout(stopRinging, maxMs);
}

export function stopRinging(): void {
  const was = ringing !== null;
  if (ringing !== null) window.clearInterval(ringing);
  if (ringStop !== null) window.clearTimeout(ringStop);
  ringing = null;
  ringStop = null;
  if (was) (navigator as NavigatorExtra).vibrate?.(0); // cancel a vibration in progress
}

export const isRinging = () => ringing !== null;
