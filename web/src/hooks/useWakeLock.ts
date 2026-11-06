import { useEffect } from 'react';

/**
 * Keep the screen on while `active` (e.g. during turn-by-turn), so the phone
 * doesn't sleep and suspend GPS. Re-acquired when the app comes back to the
 * foreground; silently does nothing where the Wake Lock API isn't supported.
 */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;

    const acquire = async () => {
      if (document.visibilityState !== 'visible' || (lock && !lock.released)) return;
      try {
        lock = await navigator.wakeLock.request('screen');
        if (cancelled) void lock.release();
      } catch {
        /* denied (e.g. low battery mode) — navigation still works */
      }
    };
    const onVisible = () => void acquire();

    void acquire();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      void lock?.release().catch(() => {});
    };
  }, [active]);
}
