import { supabase } from '@/lib/supabase';

export interface GrowthSource {
  source: string;
  devices: number;
  real_users: number;
  /** devices at least 14 days old (the only ones a "real user" rate is fair for) */
  matured: number;
  matured_real: number;
  signups: number;
  businesses: number;
}
export interface GrowthCampaign {
  source: string;
  campaign: string;
  devices: number;
  real_users: number;
}
export interface Growth {
  days: number;
  since: string;
  sources: GrowthSource[];
  campaigns: GrowthCampaign[];
}

/** Admin → Pertumbuhan: aggregates per channel (admins with 2FA only, enforced in the database). */
export async function fetchGrowth(days: number): Promise<Growth> {
  if (!supabase) throw new Error('Not connected.');
  const { data, error } = await supabase.rpc('admin_growth', { p_days: days });
  if (error) throw new Error(error.message);
  const g = data as Growth | null;
  if (!g || !Array.isArray(g.sources)) throw new Error('Statistik pertumbuhan tidak dapat dibaca.');
  return { ...g, sources: g.sources.map((s) => ({ ...s, signups: Number(s.signups) || 0, businesses: Number(s.businesses) || 0 })), campaigns: g.campaigns ?? [] };
}

/** Real-user rate among devices old enough to judge (≥14 days), as a whole percent; null if none yet. */
export function realRate(s: Pick<GrowthSource, 'matured' | 'matured_real'>): number | null {
  return s.matured > 0 ? Math.round((100 * s.matured_real) / s.matured) : null;
}
