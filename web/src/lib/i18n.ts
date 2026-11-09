import { useCallback } from 'react';
import { useVoiceLang } from '@/hooks/useVoiceAlerts';

export type Lang = 'ms' | 'en';

/**
 * Tiny bilingual helper: `t('Cari tempat', 'Search places')`.
 * The language is the same setting as voice guidance (Profile → Bahasa), Malay by default.
 */
export function useT(): [(ms: string, en: string) => string, Lang] {
  const [lang] = useVoiceLang();
  const t = useCallback((ms: string, en: string) => (lang === 'en' ? en : ms), [lang]);
  return [t, lang];
}
