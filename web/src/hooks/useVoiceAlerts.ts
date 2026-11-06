import { useCallback, useSyncExternalStore } from 'react';
import type { VoiceLang } from '@/utils/voiceInstructions';

const KEY = 'jalango:voice-alerts';
const LANG_KEY = 'jalango:voice-lang';
const EVENT = 'jalango:voice-change';

function read(): boolean {
  try {
    return localStorage.getItem(KEY) !== 'off';
  } catch {
    return true;
  }
}

function readLang(): VoiceLang {
  try {
    return localStorage.getItem(LANG_KEY) === 'en' ? 'en' : 'ms';
  } catch {
    return 'ms';
  }
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  return () => window.removeEventListener(EVENT, cb);
}

/** Voice guidance on/off (default on), shared across components. */
export function useVoiceAlerts(): [boolean, (on: boolean) => void] {
  const on = useSyncExternalStore(subscribe, read, () => true);
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

/** Voice language (Bahasa Melayu by default). */
export function useVoiceLang(): [VoiceLang, (l: VoiceLang) => void] {
  const lang = useSyncExternalStore(subscribe, readLang, () => 'ms' as VoiceLang);
  const set = useCallback((l: VoiceLang) => {
    try {
      localStorage.setItem(LANG_KEY, l);
    } catch {
      /* ignore */
    }
    window.dispatchEvent(new Event(EVENT));
  }, []);
  return [lang, set];
}

/**
 * Best installed voice: Malay if available, otherwise Indonesian (reads
 * Malay naturally), otherwise the device default. English prefers en-GB/en-MY.
 */
function pickVoice(lang: VoiceLang): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis?.getVoices?.() ?? [];
  const by = (prefix: string) => voices.find((v) => v.lang.toLowerCase().replace('_', '-').startsWith(prefix));
  if (lang === 'ms') return by('ms') ?? by('id') ?? null;
  return by('en-my') ?? by('en-gb') ?? by('en') ?? null;
}

/** Whether a proper voice for the language is installed (for the settings hint). */
export function hasVoiceFor(lang: VoiceLang): boolean {
  const v = pickVoice(lang);
  return Boolean(v && (lang === 'en' || /^(ms|id)/i.test(v.lang)));
}

/** Speak a short phrase. `interrupt` drops anything still queued (used for "now" instructions). Never throws. */
export function speak(text: string, lang: VoiceLang = 'ms', { interrupt = false } = {}) {
  try {
    const synth = window.speechSynthesis;
    if (!synth) return;
    if (interrupt) synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const voice = pickVoice(lang);
    if (voice) u.voice = voice;
    u.lang = voice?.lang ?? (lang === 'ms' ? 'ms-MY' : 'en-GB');
    u.rate = 1;
    synth.speak(u);
  } catch {
    /* unsupported */
  }
}

/**
 * iOS/Safari only allow speech after a user gesture. Call this from a tap
 * (e.g. Start) so later announcements during the drive are allowed.
 */
export function primeSpeech() {
  try {
    const synth = window.speechSynthesis;
    if (!synth) return;
    synth.getVoices();
    const u = new SpeechSynthesisUtterance(' ');
    u.volume = 0;
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
