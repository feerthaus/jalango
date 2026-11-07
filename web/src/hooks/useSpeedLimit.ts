import { useEffect, useRef } from 'react';
import { useLocation } from '@/contexts/LocationContext';
import { useRouting } from '@/contexts/RoutingContext';
import { toKmh } from '@/utils/geo';
import { isSpeeding, limitAt } from '@/utils/speedLimit';
import { speak, useVoiceAlerts, useVoiceLang, vibrate } from './useVoiceAlerts';

const OVER_FOR_MS = 4000;
const REARM_MS = 15_000;

/** Current speed limit while navigating (null = unknown). */
export function useSpeedLimit(): number | null {
  const { status, selectedRoute, progress } = useRouting();
  if (status !== 'navigating') return null;
  return limitAt(selectedRoute, progress?.segment);
}

/** One spoken warning when we've been over the limit for a few seconds; re-arms once back under it for a while. */
export function useSpeedAlert() {
  const limit = useSpeedLimit();
  const { fix } = useLocation();
  const [voiceOn] = useVoiceAlerts();
  const [lang] = useVoiceLang();
  const overSince = useRef<number | null>(null);
  const underSince = useRef<number | null>(null);
  const warned = useRef(false);

  useEffect(() => {
    if (!fix || fix.speed === null || limit === null) return;
    const now = Date.now();
    if (isSpeeding(toKmh(fix.speed), limit)) {
      underSince.current = null;
      overSince.current ??= now;
      if (!warned.current && now - overSince.current >= OVER_FOR_MS) {
        warned.current = true;
        vibrate([200, 100, 200]);
        if (voiceOn) speak(lang === 'ms' ? `Had laju ${limit}.` : `Speed limit ${limit}.`, lang);
      }
    } else {
      overSince.current = null;
      underSince.current ??= now;
      if (warned.current && now - underSince.current >= REARM_MS) warned.current = false;
    }
  }, [fix, limit, voiceOn, lang]);
}
