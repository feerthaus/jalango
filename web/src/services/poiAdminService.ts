import type { SupabaseClient } from '@supabase/supabase-js';
import { mockPoiState } from '@/components/admin/poi/mockPoiData';
import { supabase } from '@/lib/supabase';
import {
  approveRecord,
  mergeDuplicate,
  POI_CATEGORIES,
  rejectRecord,
  renamePoi,
  rollbackRun,
  searchPois,
  setPoiHidden,
  type AuditEntry,
  type Decision,
  type ImportRun,
  type Issue,
  type LivePoi,
  type Poi,
  type PoiAdminState,
  type PoiCategory,
  type PoiChange,
  type QualityMetrics,
  type RunCounts,
  type StagingRecord,
} from '@/utils/poiReview';

/**
 * What Admin → POI needs from the back end. With Supabase: the POI-2B database
 * functions (admin_poi_state, poi_review, poi_merge, poi_rollback_run, and for
 * live POIs admin_poi_search, poi_rename, poi_set_hidden; admins with 2FA only). Without Supabase (local development): an in-memory TEST
 * implementation over made-up data, labelled as such on screen.
 */
export interface PoiAdminService {
  /** true while the data is test data (the UI says so on every screen) */
  readonly testData: boolean;
  load(): Promise<PoiAdminState>;
  approve(recordId: string, category?: PoiCategory, name?: string): Promise<PoiAdminState>;
  reject(recordId: string, reason: string): Promise<PoiAdminState>;
  merge(recordId: string, intoPoiId: string): Promise<PoiAdminState>;
  rollback(runId: string): Promise<PoiAdminState>;
  /** Live POIs by name or OSM ref (hidden ones included) */
  searchLive(q: string): Promise<LivePoi[]>;
  /** Rename / change the category of a live POI; later imports keep the admin's choice */
  rename(poiId: string, name: string, category?: PoiCategory): Promise<PoiAdminState>;
  /** Hide a live POI (reason needed) or show it again; later imports keep an admin's hide */
  setHidden(poiId: string, hidden: boolean, reason?: string): Promise<PoiAdminState>;
  /** Test data: start again from the original data. Supabase: reload. */
  reset(): Promise<PoiAdminState>;
}

export function createMockPoiAdminService(actor = 'admin (ujian)', now: () => string = () => new Date().toISOString()): PoiAdminService {
  let state = mockPoiState();
  const overrides = new Set<string>();
  const hiddenByAdmin = new Set<string>();
  const apply = async (f: (s: PoiAdminState) => PoiAdminState) => {
    state = f(state);
    return state;
  };
  return {
    testData: true,
    load: async () => state,
    approve: (id, category, name) => apply((s) => approveRecord(s, id, actor, now(), category, name)),
    reject: (id, reason) => apply((s) => rejectRecord(s, id, actor, now(), reason)),
    merge: (id, into) => apply((s) => mergeDuplicate(s, id, into, actor, now())),
    rollback: (runId) => apply((s) => rollbackRun(s, runId, actor, now())),
    searchLive: async (q) => searchPois(state, q, overrides, hiddenByAdmin),
    rename: (id, name, category) =>
      apply((s) => {
        const next = renamePoi(s, id, actor, now(), name, category);
        if (next !== s) overrides.add(id);
        return next;
      }),
    setHidden: (id, hidden, reason) =>
      apply((s) => {
        const next = setPoiHidden(s, id, hidden, actor, now(), reason);
        if (hidden) hiddenByAdmin.add(id);
        else hiddenByAdmin.delete(id);
        return next;
      }),
    reset: async () => {
      overrides.clear();
      hiddenByAdmin.clear();
      return (state = mockPoiState());
    },
  };
}

// ── Supabase (POI-2B) ─────────────────────────────────────────────────────

/** admin_poi_state() as returned by the database (snake_case rows). */
export interface AdminPoiStateJson {
  runs: { id: string; region: string; source: string; extract_timestamp: string | null; started_at: string; finished_at: string | null; status: ImportRun['status']; note: string | null; counts: Record<string, number> | null }[];
  queue: { id: string; run_id: string; osm_ref: string; name: string | null; category: PoiCategory; subcategory: string | null; lat: number; lng: number; address: string | null; phone: string | null; quality: number; issues: string[]; decision: Decision; reject_reason: string | null; match_poi_id: string | null; reviewed_by: string | null; reviewed_at: string | null }[];
  matches: { id: string; osm_ref: string; name: string; category: PoiCategory; subcategory: string | null; lat: number; lng: number; address: string | null; phone: string | null; quality: number; status: 'active' | 'hidden' | 'missing'; first_run: string | null; last_seen_run: string | null }[];
  metrics: { active: number; hidden: number; needs_check: number; with_address: number; with_phone: number; with_hours: number; by_category: Partial<Record<PoiCategory, number>>; open_feedback: number };
  changes: { id: number; run_id: string | null; poi_id: string | null; action: string; reason: string | null; at: string; name: string | null }[];
}

/** admin_poi_search() rows: a pois snapshot plus the admin flags */
export type AdminPoiSearchJson = (AdminPoiStateJson['matches'][number] & { admin_override: boolean; hidden_by_admin: boolean })[];

export function livePoiFromAdmin(p: AdminPoiSearchJson[number]): LivePoi {
  return {
    id: p.id, sourceRef: p.osm_ref, name: p.name, category: p.category, subcategory: p.subcategory, lat: p.lat, lng: p.lng, address: p.address, phone: p.phone,
    quality: p.quality, status: p.status === 'active' ? 'active' : 'hidden', firstRun: p.first_run ?? '', lastSeenRun: p.last_seen_run ?? '',
    liveStatus: p.status, adminOverride: Boolean(p.admin_override), hiddenByAdmin: Boolean(p.hidden_by_admin),
  };
}

const pct = (n: number, d: number) => (d ? Math.round((1000 * n) / d) / 10 : 0);
const metres = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) =>
  Math.round(Math.hypot((a.lng - b.lng) * 111320 * Math.cos((a.lat * Math.PI) / 180), (a.lat - b.lat) * 110574));

/** Map the database's admin view to the screen's state (pure, tested). */
export function stateFromAdmin(j: AdminPoiStateJson): PoiAdminState {
  const pois: Poi[] = j.matches.map((p) => ({
    id: p.id, sourceRef: p.osm_ref, name: p.name, category: p.category, subcategory: p.subcategory, lat: p.lat, lng: p.lng,
    address: p.address, phone: p.phone, quality: p.quality, status: p.status === 'active' ? 'active' : 'hidden', firstRun: p.first_run ?? '', lastSeenRun: p.last_seen_run ?? '',
  }));
  const staging: StagingRecord[] = j.queue.map((r) => {
    const m = r.match_poi_id ? pois.find((p) => p.id === r.match_poi_id) : undefined;
    return {
      id: r.id, runId: r.run_id, sourceRef: r.osm_ref, name: r.name, category: r.category, subcategory: r.subcategory, lat: r.lat, lng: r.lng,
      address: r.address, phone: r.phone, quality: r.quality, issues: r.issues as Issue[], decision: r.decision,
      match: m ? { poiId: m.id, name: m.name, metres: metres(r, m) } : null,
      rejectReason: r.reject_reason ?? undefined, reviewedBy: r.reviewed_by ?? undefined, reviewedAt: r.reviewed_at ?? undefined,
    };
  });
  const open = (runId: string, d: Decision) => staging.filter((r) => r.runId === runId && r.decision === d).length;
  const runs: ImportRun[] = j.runs.map((r) => {
    const c = r.counts ?? {};
    // Counts at import time; the review queue (needs review, duplicates) is the live number
    const counts: RunCounts = { received: c.rows ?? 0, autoApproved: c.auto_approved ?? 0, approved: 0, needsReview: open(r.id, 'needs_review'), duplicates: open(r.id, 'duplicate'), rejected: c.rejected ?? 0, merged: 0 };
    return { id: r.id, region: r.region, source: r.source, extractTimestamp: r.extract_timestamp ?? '', startedAt: r.started_at, finishedAt: r.finished_at ?? '', status: r.status, note: r.note ?? undefined, counts };
  });
  const changes: PoiChange[] = j.changes
    .filter((c) => c.run_id && c.poi_id)
    .map((c) => ({ runId: c.run_id!, poiId: c.poi_id!, action: c.action === 'insert' ? 'insert' : c.action === 'missing' || c.action === 'hide' ? 'hide' : 'update', before: null, after: null, at: c.at }));
  const AUDIT: Partial<Record<string, AuditEntry['action']>> = { approve: 'approve', merge: 'merge', rollback: 'rollback', hide: 'hide' };
  // Admin edits of live POIs (poi_rename, poi_set_hidden) are 'update' / 'hide' with an "admin: …" or written reason
  const auditAction = (c: AdminPoiStateJson['changes'][number]): AuditEntry['action'] | undefined => {
    if (c.action === 'update') return c.reason === 'admin: nama/kategori' ? 'rename' : c.reason === 'admin: papar semula' ? 'show' : undefined;
    return AUDIT[c.action];
  };
  const audit: AuditEntry[] = j.changes
    .flatMap((c) => {
      const action = auditAction(c);
      return action ? [{ at: c.at, actor: 'admin', action, target: c.name ?? c.poi_id ?? '', note: c.reason?.startsWith('admin:') ? '' : (c.reason ?? '') }] : [];
    })
    .reverse();
  const latest = j.runs.find((r) => r.status === 'processed')?.counts ?? {};
  const backlog = staging.filter((r) => r.decision === 'needs_review' || r.decision === 'duplicate');
  const active = j.metrics.active;
  const metrics: QualityMetrics = {
    activePois: active,
    backlog: backlog.length,
    oldestBacklogRun: backlog.map((r) => runs.find((x) => x.id === r.runId)?.startedAt).filter((x): x is string => Boolean(x)).sort()[0] ?? null,
    autoApprovePct: pct(latest.auto_approved ?? 0, latest.rows ?? 0),
    rejectPct: pct(latest.rejected ?? 0, latest.rows ?? 0),
    duplicatePct: pct(latest.duplicate ?? 0, latest.rows ?? 0),
    completeness: { address: pct(j.metrics.with_address, active), phone: pct(j.metrics.with_phone, active) },
    byCategory: POI_CATEGORIES.map((c) => ({ category: c, active: j.metrics.by_category[c] ?? 0, backlog: backlog.filter((r) => r.category === c).length })),
  };
  return { runs, staging, pois, changes, audit, metrics };
}

/** Database refusals in the admin's language */
function friendly(e: { message: string; hint?: string | null }): Error {
  if (e.hint === 'nama_kosong') return new Error('Rekod ini perlu nama sebelum diluluskan.');
  if (e.hint === 'nama_generik') return new Error('Nama generik: beri nama sebenar tempat ini dahulu.');
  if (/Admins only/i.test(e.message)) return new Error('Admin sahaja, dengan 2FA.');
  if (/Already decided/i.test(e.message)) return new Error('Rekod ini sudah diputuskan.');
  if (/rolled back/i.test(e.message)) return new Error('Larian import ini sudah di-rollback.');
  if (/reason for hiding/i.test(e.message)) return new Error('Nyatakan sebab untuk sembunyikan POI ini.');
  if (/Record not found/i.test(e.message)) return new Error('Rekod tidak dijumpai (mungkin sudah berubah). Muat semula.');
  if (/Outside the area/i.test(e.message)) return new Error('Rekod di luar kawasan tidak boleh diluluskan.');
  return new Error(e.message);
}

export function createSupabasePoiAdminService(db: SupabaseClient): PoiAdminService {
  const load = async () => {
    const { data, error } = await db.rpc('admin_poi_state');
    if (error) throw friendly(error);
    return stateFromAdmin(data as AdminPoiStateJson);
  };
  const run = async (fn: string, args: Record<string, unknown>) => {
    const { error } = await db.rpc(fn, args);
    if (error) throw friendly(error);
    return load();
  };
  return {
    testData: false,
    load,
    approve: (id, category, name) => run('poi_review', { p_id: id, p_action: 'approve', p_category: category ?? null, p_name: name?.trim() || null }),
    reject: (id, reason) => run('poi_review', { p_id: id, p_action: 'reject', p_reason: reason }),
    merge: (id, into) => run('poi_merge', { p_id: id, p_into: into }),
    rollback: (runId) => run('poi_rollback_run', { p_run: runId }),
    searchLive: async (q) => {
      const { data, error } = await db.rpc('admin_poi_search', { p_q: q, p_limit: 30 });
      if (error) throw friendly(error);
      return (data as AdminPoiSearchJson).map(livePoiFromAdmin);
    },
    rename: (id, name, category) => run('poi_rename', { p_poi: id, p_name: name, p_category: category ?? null }),
    setHidden: (id, hidden, reason) => run('poi_set_hidden', { p_poi: id, p_hidden: hidden, p_reason: reason?.trim() || null }),
    reset: load,
  };
}

/** The service the Admin screen uses: the real database when Supabase is set up, test data otherwise. */
export const poiAdminService: PoiAdminService = supabase ? createSupabasePoiAdminService(supabase) : createMockPoiAdminService();
