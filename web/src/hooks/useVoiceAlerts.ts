import { useCallback, useSyncExternalStore } from 'react';

const KEY = 'jalango:voice-alerts';
const EVENT = 'jalango:voice-change';

function read(): boolean {
  try {
    return localStorage.getItem(KEY) !== 'off';
  } catch {
    return true;
  }
}

/** Spoken alerts on/off (default on), shared across components. */
export function useVoiceAlerts(): [boolean, (on: boolean) => void] {
  const on = useSyncExternalStore(
    (cb) => {
      window.addEventListener(EVENT, cb);
      return () => window.removeEventListener(EVENT, cb);
    },
    read,
    () => true,
  );
  const set = useCallback((v: boolean) => {
    try {
      localStorage.setItem(KEY, v ? 'on' : 'off');
    } catch {
      /* ignore */
    }
    if (!v) window.speechSynthesis?.cancel();
    window.dispatchEvent(new Event(EVENT));
  }, []);
  return [on, set];
}

/** Speak a short phrase if the browser supports it. Never throws. */
export function speak(text: string) {
  try {
    const synth = window.speechSynthesis;
    if (!synth) return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-GB';
    u.rate = 1.05;
    synth.speak(u);
  } catch {
    /* unsupported */
  }
}

export function vibrate(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* unsupported */
  }
}
