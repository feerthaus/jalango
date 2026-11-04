import { useCallback, useSyncExternalStore } from 'react';

export type ProbeConsent = 'granted' | 'denied' | null;

const KEY = 'jalango:probe-consent';
const EVENT = 'jalango:probe-consent-change';

function read(): ProbeConsent {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'granted' || v === 'denied' ? v : null;
  } catch {
    return null;
  }
}

/** Whether the user agreed to share anonymous traffic data. `null` = not asked yet. */
export function useProbeConsent(): [ProbeConsent, (v: Exclude<ProbeConsent, null>) => void] {
  const consent = useSyncExternalStore(
    (cb) => {
      window.addEventListener(EVENT, cb);
      window.addEventListener('storage', cb);
      return () => {
        window.removeEventListener(EVENT, cb);
        window.removeEventListener('storage', cb);
      };
    },
    read,
    () => null,
  );
  const set = useCallback((v: Exclude<ProbeConsent, null>) => {
    try {
      localStorage.setItem(KEY, v);
    } catch {
      /* ignore */
    }
    window.dispatchEvent(new Event(EVENT));
  }, []);
  return [consent, set];
}
