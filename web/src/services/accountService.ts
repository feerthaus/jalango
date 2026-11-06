import { supabase } from '@/lib/supabase';
import { apiPost } from './apiClient';

/** Permanently delete the signed-in account (server-side), then clear this device. */
export async function deleteMyAccount(): Promise<void> {
  if (!supabase) throw new Error('Accounts are not available.');
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Please sign in again first.');
  await apiPost('/account/delete', {}, token);
  await supabase.auth.signOut().catch(() => {});
  clearLocalData();
}

/** Remove everything JalanGo stored on this device. */
export function clearLocalData() {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith('jalango:'))
      .forEach((k) => localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}

export async function sendFeedback(input: { category: string; message: string; contact?: string; page?: string }): Promise<void> {
  const token = supabase ? (await supabase.auth.getSession()).data.session?.access_token : null;
  await apiPost('/feedback', input, token);
}
