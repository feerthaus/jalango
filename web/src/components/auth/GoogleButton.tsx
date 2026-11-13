import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { GOOGLE_CLIENT_ID, renderGoogleButton } from '@/lib/googleIdentity';

/**
 * Google's own button on our page, so the Google screen names our site (not
 * the Supabase address). If it can't load, shows our redirect button instead.
 */
export function GoogleButton({ fallback, onError, onBusy }: { fallback: React.ReactNode; onError: (msg: string) => void; onBusy: (b: boolean) => void }) {
  const { signInWithGoogleToken } = useAuth();
  const ref = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(!GOOGLE_CLIENT_ID);
  const cb = useRef({ signInWithGoogleToken, onError, onBusy });
  cb.current = { signInWithGoogleToken, onError, onBusy };

  useEffect(() => {
    const el = ref.current;
    if (!el || !GOOGLE_CLIENT_ID) return;
    let alive = true;
    renderGoogleButton(
      el,
      (token, nonce) => {
        cb.current.onBusy(true);
        cb.current
          .signInWithGoogleToken(token, nonce)
          .catch((e: Error) => cb.current.onError(e.message))
          .finally(() => cb.current.onBusy(false));
      },
      el.parentElement?.clientWidth ?? 320,
      () => alive,
    ).catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, []);

  if (failed) return <>{fallback}</>;
  return <div ref={ref} className="flex min-h-[44px] justify-center" data-testid="google-gis" />;
}
