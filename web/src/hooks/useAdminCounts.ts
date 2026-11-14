import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { ADMIN_CHANGED_EVENT, fetchAdminCounts, type AdminCounts } from '@/services/adminCounts';

const POLL_MS = 60_000;

type Nav = Navigator & { setAppBadge?: (n?: number) => Promise<void>; clearAppBadge?: () => Promise<void> };

/** Show the number on the installed app's icon (Android Chrome, iPhone 16.4+ home-screen app). */
function setIconBadge(n: number) {
  const nav = navigator as Nav;
  try {
    if (n > 0) void nav.setAppBadge?.(n)?.catch(() => undefined);
    else void nav.clearAppBadge?.()?.catch(() => undefined);
  } catch {
    /* not supported */
  }
}

/**
 * Admin notification counts, refreshed every minute, when the app comes back
 * to the front and after any admin action. Null for everyone who isn't a
 * (2FA-verified) admin, so it is safe to use anywhere.
 */
export function useAdminCounts(): AdminCounts | null {
  const { user } = useAuth();
  const [counts, setCounts] = useState<AdminCounts | null>(null);

  useEffect(() => {
    if (!user) {
      setCounts(null);
      return;
    }
    let alive = true;
    const load = () => {
      if (document.visibilityState === 'hidden') return;
      void fetchAdminCounts().then((c) => {
        if (!alive) return;
        setCounts(c);
        if (c) setIconBadge(c.total);
      });
    };
    load();
    const id = setInterval(load, POLL_MS);
    document.addEventListener('visibilitychange', load);
    window.addEventListener(ADMIN_CHANGED_EVENT, load);
    return () => {
      alive = false;
      clearInterval(id);
      document.removeEventListener('visibilitychange', load);
      window.removeEventListener(ADMIN_CHANGED_EVENT, load);
    };
  }, [user]);

  return counts;
}
