import { supabase } from '@/lib/supabase';

export interface AdminCounts {
  operators: number;
  listings: number;
  flags: number;
  photos: number;
  feedback: number;
  total: number;
}

const CHANGED = 'jalango:admin-changed';

/** Waiting items per admin tab. Null when not an admin (or no 2FA session). */
export async function fetchAdminCounts(): Promise<AdminCounts | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc('admin_counts');
  if (error || !data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  const n = (k: string) => Math.max(0, Number(d[k]) || 0);
  return { operators: n('operators'), listings: n('listings'), flags: n('flags'), photos: n('photos'), feedback: n('feedback'), total: n('total') };
}

/** Call after an admin action so every badge refreshes. */
export function adminChanged(): void {
  window.dispatchEvent(new Event(CHANGED));
}
export const ADMIN_CHANGED_EVENT = CHANGED;
