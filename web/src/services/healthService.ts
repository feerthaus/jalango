import { apiGet } from './apiClient';

export interface ServerHealth {
  reachable: boolean;
  mapbox: boolean;
  supabase: boolean;
  /** Claude API key set: smart search and the trip assistant are on */
  ai: boolean;
}

export async function fetchServerHealth(signal?: AbortSignal): Promise<ServerHealth> {
  try {
    const body = await apiGet<{ ok: boolean; integrations: { mapbox: boolean; supabase: boolean; ai?: boolean } }>('/health', {}, signal);
    return { reachable: true, mapbox: body.integrations.mapbox, supabase: body.integrations.supabase, ai: Boolean(body.integrations.ai) };
  } catch {
    return { reachable: false, mapbox: false, supabase: false, ai: false };
  }
}
