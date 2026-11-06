import { useEffect, useState } from 'react';
import { env, features } from '@/lib/config';

export type OAuthProviderName = 'google' | 'facebook';
type Enabled = Record<OAuthProviderName, boolean>;

let cached: Promise<Enabled> | null = null;

/** Which social logins are switched on in Supabase Auth (public settings endpoint). */
function load(): Promise<Enabled> {
  if (!features.supabase) return Promise.resolve({ google: false, facebook: false });
  cached ??= fetch(`${env.supabaseUrl}/auth/v1/settings`, { headers: { apikey: env.supabaseAnonKey! } })
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
    .then((s: { external?: Partial<Enabled> }) => ({ google: Boolean(s.external?.google), facebook: Boolean(s.external?.facebook) }))
    .catch(() => {
      cached = null; // try again next time
      return { google: false, facebook: false };
    });
  return cached;
}

/** `null` while checking. Buttons for disabled providers are hidden instead of leading to an error page. */
export function useOAuthProviders(): Enabled | null {
  const [enabled, setEnabled] = useState<Enabled | null>(null);
  useEffect(() => {
    let alive = true;
    void load().then((e) => alive && setEnabled(e));
    return () => {
      alive = false;
    };
  }, []);
  return enabled;
}
