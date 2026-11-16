import { useCallback } from 'react';
import { useVoiceLang } from '@/hooks/useVoiceAlerts';

/**
 * App languages. Malay first, English second. Planned next: Thai ('th'),
 * Indonesian ('id') and Filipino ('fil'): add the code here, add it to the
 * language picker, then translate strings over time. Any string without that
 * language falls back to English, then Malay, so nothing ever shows blank.
 */
export type Lang = 'ms' | 'en';
export type FutureLang = 'th' | 'id' | 'fil';

/** One piece of UI text in every language we have it in (ms and en are required). */
export type Msg = { ms: string; en: string } & Partial<Record<FutureLang, string>>;

/** Text for `lang`: the exact language, else English, else Malay. */
export function tr(msg: Msg, lang: Lang | FutureLang): string {
  return (msg as Record<string, string | undefined>)[lang] ?? msg.en ?? msg.ms;
}

export type TFn = {
  (ms: string, en: string): string;
  (msg: Msg): string;
};

/**
 * `const [t, lang] = useT()` then `t('Cari tempat', 'Search places')` or
 * `t({ ms: 'Cari tempat', en: 'Search places', th: '…' })`.
 * The language is the same setting as voice guidance (Profil → Bahasa), Malay by default.
 *
 * Rule (checked by i18n.guard.test.ts): every piece of text a user can see goes
 * through t(); no bare Malay or English in JSX.
 */
export function useT(): [TFn, Lang] {
  const [lang] = useVoiceLang();
  const t = useCallback(
    (a: string | Msg, en?: string) => (typeof a === 'string' ? tr({ ms: a, en: en ?? a }, lang) : tr(a, lang)),
    [lang],
  ) as TFn;
  return [t, lang];
}
