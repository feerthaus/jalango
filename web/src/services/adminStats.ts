import { supabase } from '@/lib/supabase';

export interface DailyStat {
  day: string;
  active: number;
  new: number;
  searches: number;
  routes: number;
}

export interface AdminStats {
  today: string;
  active_today: number;
  active_7d: number;
  active_30d: number;
  devices_total: number;
  installed_7d: number;
  daily: DailyStat[];
  accounts_total: number;
  accounts_7d: number;
  reports_7d: number;
  reports_total: number;
  accident_records: number;
  photos_pending: number;
  community_routes: number;
  shortcuts: number;
  convoys_7d: number;
  live_shares_7d: number;
  trips_synced: number;
}

export async function fetchAdminStats(): Promise<AdminStats> {
  if (!supabase) throw new Error('Not connected.');
  const { data, error } = await supabase.rpc('admin_stats');
  if (error) throw new Error(error.message);
  return data as AdminStats;
}
