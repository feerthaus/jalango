import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { ConfirmationType, NewReport, TrafficReport } from '@/types';

/**
 * Community reports, stored in Supabase. All rules (rate limits, duplicate
 * detection, Malaysia bounds, vote counting) are enforced in the database;
 * this module only maps them to friendly messages.
 */

export const DESCRIPTION_MAX = 280;
const COLUMNS = 'id,user_id,report_type,description,latitude,longitude,status,confirm_count,resolve_count,expires_at,created_at,updated_at';

export class ReportError extends Error {
  constructor(
    message: string,
    public readonly code: 'not_configured' | 'auth' | 'rate_limited' | 'duplicate' | 'inactive' | 'own_report' | 'invalid' | 'network',
  ) {
    super(message);
  }
}

function client(): SupabaseClient {
  if (!supabase) throw new ReportError('Community reports are not connected yet.', 'not_configured');
  return supabase;
}

interface PgError {
  message: string;
  code?: string;
  hint?: string | null;
  details?: string | null;
}

export function toReportError(err: PgError): ReportError {
  const hint = err.hint ?? '';
  if (hint === 'rate_limited') return new ReportError(err.message, 'rate_limited');
  if (hint === 'duplicate') return new ReportError(err.message, 'duplicate');
  if (hint === 'inactive') return new ReportError(err.message, 'inactive');
  if (hint === 'own_report') return new ReportError(err.message, 'own_report');
  if (err.code === '23505') return new ReportError('You have already voted on this report.', 'duplicate');
  if (err.code === '23514') return new ReportError('Reports can only be made for locations in Malaysia.', 'invalid');
  if (err.code === '42501' || /row-level security|JWT|not allowed/i.test(err.message)) {
    return new ReportError('Please sign in again to continue.', 'auth');
  }
  if (/fetch|network/i.test(err.message)) return new ReportError('Can’t reach the server. Check your connection.', 'network');
  return new ReportError(err.message || 'Something went wrong.', 'invalid');
}

export interface Bounds {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

export async function fetchActiveReports(bounds: Bounds, signal?: AbortSignal): Promise<TrafficReport[]> {
  let q = client()
    .from('traffic_reports')
    .select(COLUMNS)
    .eq('status', 'active')
    .gt('expires_at', new Date().toISOString())
    .gte('latitude', bounds.minLat)
    .lte('latitude', bounds.maxLat)
    .gte('longitude', bounds.minLng)
    .lte('longitude', bounds.maxLng)
    .order('created_at', { ascending: false })
    .limit(300);
  if (signal) q = q.abortSignal(signal);
  const { data, error } = await q;
  if (error) throw toReportError(error);
  return (data ?? []) as TrafficReport[];
}

export async function fetchMyVotes(reportIds: string[], userId: string): Promise<Record<string, ConfirmationType>> {
  if (reportIds.length === 0) return {};
  const { data, error } = await client()
    .from('report_confirmations')
    .select('report_id,confirmation_type')
    .eq('user_id', userId)
    .in('report_id', reportIds.slice(0, 300));
  if (error) throw toReportError(error);
  return Object.fromEntries((data ?? []).map((r) => [r.report_id as string, r.confirmation_type as ConfirmationType]));
}

export function validateNewReport(r: NewReport): string | null {
  if (r.description.trim().length > DESCRIPTION_MAX) return `Keep the description under ${DESCRIPTION_MAX} characters.`;
  if (!Number.isFinite(r.coordinates.lat) || !Number.isFinite(r.coordinates.lng)) return 'Your location is not available.';
  return null;
}

export async function submitReport(r: NewReport, userId: string): Promise<TrafficReport> {
  const invalid = validateNewReport(r);
  if (invalid) throw new ReportError(invalid, 'invalid');
  const { data, error } = await client()
    .from('traffic_reports')
    .insert({
      user_id: userId,
      report_type: r.type,
      description: r.description.trim() || null,
      latitude: Math.round(r.coordinates.lat * 1e6) / 1e6,
      longitude: Math.round(r.coordinates.lng * 1e6) / 1e6,
    })
    .select(COLUMNS)
    .single();
  if (error) throw toReportError(error);
  return data as TrafficReport;
}

export async function voteOnReport(reportId: string, userId: string, type: ConfirmationType): Promise<void> {
  const { error } = await client().from('report_confirmations').insert({ report_id: reportId, user_id: userId, confirmation_type: type });
  if (error) throw toReportError(error);
}

export async function deleteReport(reportId: string): Promise<void> {
  const { error } = await client().from('traffic_reports').delete().eq('id', reportId);
  if (error) throw toReportError(error);
}

export type ReportChange =
  | { kind: 'upsert'; report: TrafficReport }
  | { kind: 'delete'; id: string };

/** Live INSERT/UPDATE/DELETE events for traffic_reports. Returns an unsubscribe function. */
export function subscribeToReports(onChange: (c: ReportChange) => void, onStatus: (live: boolean) => void): () => void {
  if (!supabase) return () => {};
  const channel: RealtimeChannel = supabase
    .channel('jalango-traffic-reports')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'traffic_reports' }, (payload) => {
      if (payload.eventType === 'DELETE') {
        const id = (payload.old as { id?: string }).id;
        if (id) onChange({ kind: 'delete', id });
      } else {
        onChange({ kind: 'upsert', report: payload.new as TrafficReport });
      }
    })
    .subscribe((status) => onStatus(status === 'SUBSCRIBED'));
  return () => {
    void supabase?.removeChannel(channel);
  };
}

/** Whether a report should be shown on the map right now. */
export function isVisible(r: TrafficReport, now = Date.now()): boolean {
  return r.status === 'active' && new Date(r.expires_at).getTime() > now;
}
