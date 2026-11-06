import { useCallback, useEffect, useState } from 'react';
import { isIos, isStandalone } from '@/lib/pwa';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// Captured once at module load so the event isn't missed before React mounts
let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    listeners.forEach((l) => l());
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    listeners.forEach((l) => l());
  });
}

export type InstallMode = 'installed' | 'prompt' | 'ios' | 'unavailable';

/**
 * Add-to-home-screen support:
 *  - Android/desktop Chrome & Edge: native install prompt
 *  - iOS Safari: no prompt API → show Share → Add to Home Screen steps
 */
export function useInstallPrompt(): { mode: InstallMode; install: () => Promise<boolean> } {
  const [, rerender] = useState(0);
  useEffect(() => {
    const l = () => rerender((n) => n + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);

  const mode: InstallMode = isStandalone() ? 'installed' : deferred ? 'prompt' : isIos() ? 'ios' : 'unavailable';

  const install = useCallback(async () => {
    if (!deferred) return false;
    const e = deferred;
    await e.prompt();
    const { outcome } = await e.userChoice;
    deferred = null;
    listeners.forEach((l) => l());
    return outcome === 'accepted';
  }, []);

  return { mode, install };
}
