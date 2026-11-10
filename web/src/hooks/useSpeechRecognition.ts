import { useCallback, useEffect, useRef, useState } from 'react';

/* Minimal typings for the Web Speech API (not in lib.dom for all TS targets). */
interface SpeechAlternative { transcript: string; confidence: number }
interface SpeechResult { isFinal: boolean; length: number; [i: number]: SpeechAlternative }
interface SpeechEvent { resultIndex: number; results: { length: number; [i: number]: SpeechResult } }
interface Recognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onresult: ((e: SpeechEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type RecognitionCtor = new () => Recognition;

function ctor(): RecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export const speechRecognitionSupported = () => ctor() !== null;

export type SpeechError = 'not-allowed' | 'no-speech' | 'network' | 'unsupported' | 'other';

export interface SpeechState {
  listening: boolean;
  /** What has been heard so far (live) */
  interim: string;
  error: SpeechError | null;
}

/**
 * Speech-to-text with the browser's own recogniser (Chrome on Android,
 * Safari on iOS). Audio is handled by the phone/browser vendor; JalanGo
 * only receives the text.
 */
export function useSpeechRecognition(lang: string) {
  const [state, setState] = useState<SpeechState>({ listening: false, interim: '', error: null });
  const rec = useRef<Recognition | null>(null);

  useEffect(() => () => rec.current?.abort(), []);

  const stop = useCallback(() => rec.current?.stop(), []);
  const cancel = useCallback(() => {
    rec.current?.abort();
    rec.current = null;
    setState({ listening: false, interim: '', error: null });
  }, []);

  /** Listen for one phrase. Resolves with the final text, or null (nothing heard / error / cancelled). */
  const listen = useCallback(
    () =>
      new Promise<string | null>((resolve) => {
        const C = ctor();
        if (!C) {
          setState({ listening: false, interim: '', error: 'unsupported' });
          return resolve(null);
        }
        rec.current?.abort();
        const r = new C();
        rec.current = r;
        r.lang = lang;
        r.interimResults = true;
        r.continuous = false;
        r.maxAlternatives = 1;
        let finalText = '';
        let latest = '';
        r.onresult = (e) => {
          let interim = '';
          for (let i = e.resultIndex; i < e.results.length; i++) {
            const res = e.results[i];
            if (res.isFinal) finalText += res[0].transcript;
            else interim += res[0].transcript;
          }
          latest = (finalText + interim).trim();
          setState((s) => ({ ...s, interim: latest }));
        };
        r.onerror = (e) => {
          const error: SpeechError = e.error === 'not-allowed' || e.error === 'service-not-allowed' ? 'not-allowed' : e.error === 'no-speech' ? 'no-speech' : e.error === 'network' ? 'network' : e.error === 'aborted' ? 'other' : 'other';
          if (e.error !== 'aborted') setState((s) => ({ ...s, error }));
        };
        r.onend = () => {
          if (rec.current === r) rec.current = null;
          setState((s) => ({ ...s, listening: false }));
          // Some browsers end without marking the last result final
          const text = (finalText || latest).trim();
          resolve(text || null);
        };
        setState({ listening: true, interim: '', error: null });
        try {
          r.start();
        } catch {
          setState({ listening: false, interim: '', error: 'other' });
          resolve(null);
        }
      }),
    [lang],
  );

  return { ...state, listen, stop, cancel };
}
