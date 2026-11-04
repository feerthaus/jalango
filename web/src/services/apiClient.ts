import { env } from '@/lib/config';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

/** True for failures where the live service can't help us (→ demo fallback). */
export function isServiceUnavailable(err: unknown): boolean {
  if (err instanceof ApiError) {
    return err.status === 0 || err.status === 404 || err.status >= 500 || err.code === 'mapbox_not_configured';
  }
  return true;
}

export async function apiGet<T>(path: string, params: Record<string, string | number | undefined> = {}, signal?: AbortSignal): Promise<T> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined) qs.set(k, String(v));
  const url = `${env.apiBaseUrl}/api${path}${qs.size ? `?${qs}` : ''}`;

  let res: Response;
  try {
    res = await fetch(url, { signal, headers: { Accept: 'application/json' } });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    throw new ApiError(0, 'network_error', 'Cannot reach the JalanGo server');
  }

  const isJson = res.headers.get('content-type')?.includes('application/json');
  const body = isJson ? await res.json().catch(() => null) : null;
  if (!res.ok || !isJson) {
    const e = body?.error;
    throw new ApiError(res.ok ? 502 : res.status, e?.code ?? 'http_error', e?.message ?? `Request failed (${res.status})`);
  }
  return body as T;
}
