import { apiGet } from './apiClient';

export interface ServerHealth {
  reachable: boolean;
  mapbox: boolean;
  supabase: boolean;
}

export async function fetchServerHealth(signal?: AbortSignal): Promise<ServerHealth> {
  try {
    const body = await apiGet<{ ok: boolean; integrations: { mapbox: boolean; supabase: boolean } }>('/health', {}, signal);
    return { reachable: true, mapbox: body.integrations.mapbox, supabase: body.integrations.supabase };
  } catch {
    return { reachable: false, mapbox: false, supabase: false };
  }
}
