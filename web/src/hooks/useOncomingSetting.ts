import { useCallback, useSyncExternalStore } from 'react';

const KEY = 'jalango:oncoming-alerts';
const EVENT = 'jalango:oncoming-change';

function read(): boolean {
  try {
    return localStorage.getItem(KEY) === 'on';
  } catch {
    return false;
  }
}

/** Experimental oncoming-vehicle alerts: OFF by default, needs explicit acknowledgement. */
export function useOncomingSetting(): [boolean, (on: boolean) => void] {
  const on = useSyncExternalStore(
    (cb) => {
      window.addEventListener(EVENT, cb);
      return () => window.removeEventListener(EVENT, cb);
    },
    read,
    () => false,
  );
  const set = useCallback((v: boolean) => {
    try {
      localStorage.setItem(KEY, v ? 'on' : 'off');
    } catch {
      /* ignore */
    }
    window.dispatchEvent(new Event(EVENT));
  }, []);
  return [on, set];
}
