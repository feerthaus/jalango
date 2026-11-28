/** The build this app runs (see buildVersion in vite.config.ts). */
export const appCommit: string = typeof __APP_COMMIT__ === 'string' ? __APP_COMMIT__ : 'local';
export const appBuiltAt: string | null = typeof __APP_BUILT_AT__ === 'string' ? __APP_BUILT_AT__ : null;

export const shortCommit = (c: string) => (/^[0-9a-f]{7,40}$/i.test(c) ? c.slice(0, 7) : c);

export interface LiveVersion {
  commit: string;
  builtAt: string | null;
}

/** What the site serves right now (/version.json, never cached). null when unknown. */
export async function fetchLiveVersion(signal?: AbortSignal): Promise<LiveVersion | null> {
  try {
    const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store', signal });
    if (!res.ok) return null;
    const j = (await res.json()) as { commit?: unknown; builtAt?: unknown };
    return typeof j.commit === 'string' ? { commit: j.commit, builtAt: typeof j.builtAt === 'string' ? j.builtAt : null } : null;
  } catch {
    return null;
  }
}
