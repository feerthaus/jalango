import { useSyncExternalStore } from 'react';

/**
 * Are we actually reaching the internet? navigator.onLine only knows about the
 * phone's radio, so failed / successful API calls also feed into this.
 */
let apiFailing = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function markApiResult(ok: boolean) {
  if (apiFailing === !ok) return;
  apiFailing = !ok;
  emit();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener('online', cb);
  window.addEventListener('offline', cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener('online', cb);
    window.removeEventListener('offline', cb);
  };
}

export function isOnline(): boolean {
  return (typeof navigator === 'undefined' || navigator.onLine !== false) && !apiFailing;
}

export function useOnline(): boolean {
  return useSyncExternalStore(subscribe, isOnline, () => true);
}
