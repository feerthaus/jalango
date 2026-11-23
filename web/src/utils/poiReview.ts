/**
 * POI review workflow (POI-2A): the rules the Admin → POI screen follows,
 * as pure functions over one state object, so they are unit-tested and the
 * same rules can later run against Supabase (POI-2B) without touching the UI.
 *
 * Nothing here talks to a database. The state comes from Supabase
 * (services/poiAdminService.ts, POI-2B) or, without Supabase, from clearly
 * labelled TEST data (components/admin/poi/mockPoiData.ts).
 */

export const POI_CATEGORIES = ['restoran', 'penginapan', 'minyak', 'bengkel', 'runcit', 'kesihatan', 'tarikan', 'ibadah'] as const;
export type PoiCategory = (typeof POI_CATEGORIES)[number];

export const CATEGORY_LABEL: Record<PoiCategory, string> = {
  restoran: 'Restoran & kedai makan',
  penginapan: 'Hotel & penginapan',
  minyak: 'Stesen minyak',
  bengkel: 'Bengkel & pusat servis',
  runcit: 'Kedai runcit & pasar raya',
  kesihatan: 'Klinik & farmasi',
  tarikan: 'Tarikan pelancongan',
  ibadah: 'Masjid & surau',
};

export type Issue =
  | 'nama_kosong' | 'nama_terlalu_pendek' | 'nama_generik' | 'pelbagai_kategori' | 'telefon_tidak_sah' | 'koordinat_luar_julat' | 'pendua' | 'padanan_jalango'
  // import rules (server/src/poi/rules.ts)
  | 'nama_jenama_sahaja' | 'kategori_meragukan' | 'institusi' | 'luar_kawasan' | 'data_lapuk';
export const ISSUE_LABEL: Record<Issue, string> = {
  nama_kosong: 'Nama kosong',
  nama_terlalu_pendek: 'Nama terlalu pendek',
  nama_generik: 'Nama generik',
  pelbagai_kategori: 'Pelbagai kategori',
  telefon_tidak_sah: 'Telefon tidak sah',
  koordinat_luar_julat: 'Koordinat di luar kawasan',
  pendua: 'Mungkin pendua',
  padanan_jalango: 'Mungkin sama dengan tempat JalanGo',
  nama_jenama_sahaja: 'Nama jenama sahaja',
  kategori_meragukan: 'Kategori meragukan',
  institusi: 'Dalam kawasan institusi',
  luar_kawasan: 'Luar daerah',
  data_lapuk: 'Data OSM lebih 5 tahun',
};

export type Decision = 'auto_approved' | 'needs_review' | 'rejected' | 'duplicate' | 'approved' | 'merged' | 'rolled_back';

export interface Match {
  /** an existing POI this record may be the same place as */
  poiId: string;
  name: string;
  metres: number;
}

export interface StagingRecord {
  id: string;
  runId: string;
  sourceRef: string;
  name: string | null;
  category: PoiCategory;
  subcategory: string | null;
  lat: number;
  lng: number;
  address: string | null;
  phone: string | null;
  quality: number;
  issues: Issue[];
  decision: Decision;
  match: Match | null;
  rejectReason?: string;
  reviewedBy?: string;
  reviewedAt?: string;
}

export interface Poi {
  id: string;
  sourceRef: string;
  name: string;
  category: PoiCategory;
  subcategory: string | null;
  lat: number;
  lng: number;
  address: string | null;
  phone: string | null;
  quality: number;
  status: 'active' | 'hidden';
  firstRun: string;
  lastSeenRun: string;
}

export type RunStatus = 'running' | 'processed' | 'held' | 'rolled_back' | 'failed';
export interface ImportRun {
  id: string;
  region: string;
  source: string;
  extractTimestamp: string;
  startedAt: string;
  finishedAt: string;
  status: RunStatus;
  note?: string;
  /** counts kept by the database for the whole run (the screen only loads the review queue) */
  counts?: RunCounts;
}

export interface PoiChange {
  runId: string;
  poiId: string;
  action: 'insert' | 'update' | 'hide';
  before: Poi | null;
  after: Poi | null;
  at: string;
}

export interface AuditEntry {
  at: string;
  actor: string;
  action: 'approve' | 'reject' | 'merge' | 'rollback' | 'recategorise' | 'rename';
  target: string;
  note: string;
}

export interface PoiAdminState {
  runs: ImportRun[];
  staging: StagingRecord[];
  pois: Poi[];
  changes: PoiChange[];
  audit: AuditEntry[];
  /** metrics computed by the database over all POIs (when loaded from Supabase) */
  metrics?: QualityMetrics;
}

export class PoiReviewError extends Error {}

const OPEN: Decision[] = ['needs_review', 'duplicate'];

function find(state: PoiAdminState, recordId: string): StagingRecord {
  const r = state.staging.find((x) => x.id === recordId);
  if (!r) throw new PoiReviewError('Rekod tidak dijumpai.');
  if (!OPEN.includes(r.decision)) throw new PoiReviewError('Rekod ini sudah diputuskan.');
  const run = state.runs.find((x) => x.id === r.runId);
  if (run?.status === 'rolled_back') throw new PoiReviewError('Larian import ini sudah di-rollback.');
  return r;
}

const reviewed = (r: StagingRecord, decision: Decision, actor: string, at: string, extra: Partial<StagingRecord> = {}): StagingRecord => ({ ...r, ...extra, decision, reviewedBy: actor, reviewedAt: at });

/**
 * Approve a record (optionally into another category, or with a corrected
 * name): it becomes an active POI, recorded as a change of its run. A generic
 * name ("Surau", "Kedai") is useless in search, so it needs a real name first.
 */
export function approveRecord(state: PoiAdminState, recordId: string, actor: string, at: string, category?: PoiCategory, rename?: string): PoiAdminState {
  const r = find(state, recordId);
  const newName = rename?.replace(/\s+/g, ' ').trim();
  if (newName !== undefined && newName !== (r.name ?? '') && newName.length < 3) throw new PoiReviewError('Nama baharu terlalu pendek.');
  const renamed = Boolean(newName && newName !== r.name);
  const name = renamed ? newName! : r.name;
  if (!name) throw new PoiReviewError('Rekod tanpa nama tidak boleh diluluskan.');
  if (r.issues.includes('nama_generik') && !renamed) throw new PoiReviewError('Nama generik: masukkan nama sebenar premis dahulu, atau tolak.');
  if (r.issues.includes('koordinat_luar_julat')) throw new PoiReviewError('Koordinat di luar kawasan: tolak, jangan luluskan.');
  if (state.pois.some((p) => p.sourceRef === r.sourceRef)) throw new PoiReviewError('Sumber ini sudah ada sebagai POI: gunakan "Gabung".');
  const cat = category ?? r.category;
  const poi: Poi = { id: `poi:${r.sourceRef}`, sourceRef: r.sourceRef, name, category: cat, subcategory: cat === r.category ? r.subcategory : null, lat: r.lat, lng: r.lng, address: r.address, phone: r.phone, quality: r.quality, status: 'active', firstRun: r.runId, lastSeenRun: r.runId };
  const audit: AuditEntry[] = [{ at, actor, action: 'approve', target: r.sourceRef, note: name }];
  if (renamed) audit.push({ at, actor, action: 'rename', target: r.sourceRef, note: `${r.name ?? '(tiada nama)'} → ${name}` });
  if (cat !== r.category) audit.push({ at, actor, action: 'recategorise', target: r.sourceRef, note: `${CATEGORY_LABEL[r.category]} → ${CATEGORY_LABEL[cat]}` });
  return {
    ...state,
    staging: state.staging.map((x) => (x.id === r.id ? reviewed(r, 'approved', actor, at, { category: cat, name }) : x)),
    pois: [...state.pois, poi],
    changes: [...state.changes, { runId: r.runId, poiId: poi.id, action: 'insert', before: null, after: poi, at }],
    audit: [...state.audit, ...audit],
  };
}

/** Reject a record with a reason; nothing goes live. */
export function rejectRecord(state: PoiAdminState, recordId: string, actor: string, at: string, reason: string): PoiAdminState {
  const r = find(state, recordId);
  const why = reason.trim();
  if (!why) throw new PoiReviewError('Nyatakan sebab penolakan.');
  return {
    ...state,
    staging: state.staging.map((x) => (x.id === r.id ? reviewed(r, 'rejected', actor, at, { rejectReason: why }) : x)),
    audit: [...state.audit, { at, actor, action: 'reject', target: r.sourceRef, note: why }],
  };
}

/**
 * Same place as an existing POI: the POI is kept (and marked seen in this
 * run); missing details (address, phone) are filled in from the record.
 */
export function mergeDuplicate(state: PoiAdminState, recordId: string, intoPoiId: string, actor: string, at: string): PoiAdminState {
  const r = find(state, recordId);
  const target = state.pois.find((p) => p.id === intoPoiId);
  if (!target || target.status !== 'active') throw new PoiReviewError('POI sasaran tidak dijumpai.');
  const after: Poi = { ...target, address: target.address ?? r.address, phone: target.phone ?? r.phone, lastSeenRun: r.runId };
  return {
    ...state,
    staging: state.staging.map((x) => (x.id === r.id ? reviewed(r, 'merged', actor, at) : x)),
    pois: state.pois.map((p) => (p.id === target.id ? after : p)),
    changes: [...state.changes, { runId: r.runId, poiId: target.id, action: 'update', before: target, after, at }],
    audit: [...state.audit, { at, actor, action: 'merge', target: r.sourceRef, note: `→ ${target.name}` }],
  };
}

/**
 * Undo everything one import run changed, newest change first: inserted POIs
 * go, updated or hidden POIs get their earlier values back. Its staging
 * records are closed so they can't be approved again.
 */
export function rollbackRun(state: PoiAdminState, runId: string, actor: string, at: string): PoiAdminState {
  const run = state.runs.find((x) => x.id === runId);
  if (!run) throw new PoiReviewError('Larian tidak dijumpai.');
  if (run.status === 'rolled_back') throw new PoiReviewError('Larian ini sudah di-rollback.');
  const mine = state.changes.filter((c) => c.runId === runId);
  let pois = state.pois;
  for (const c of [...mine].reverse()) {
    if (c.action === 'insert') pois = pois.filter((p) => p.id !== c.poiId);
    else if (c.before) pois = pois.map((p) => (p.id === c.poiId ? c.before! : p));
  }
  return {
    ...state,
    runs: state.runs.map((x) => (x.id === runId ? { ...x, status: 'rolled_back' } : x)),
    pois,
    changes: state.changes.filter((c) => c.runId !== runId),
    staging: state.staging.map((s) => (s.runId === runId && s.decision !== 'rejected' ? { ...s, decision: 'rolled_back' } : s)),
    audit: [...state.audit, { at, actor, action: 'rollback', target: runId, note: `${mine.length} perubahan dikembalikan` }],
  };
}

export interface QueueFilter {
  category?: PoiCategory | 'all';
  issue?: Issue | 'all';
  decision?: 'open' | Decision;
}

/** Records waiting for an admin by default, lowest quality first. */
export function reviewQueue(state: PoiAdminState, f: QueueFilter = {}): StagingRecord[] {
  const live = new Set(state.runs.filter((r) => r.status !== 'rolled_back').map((r) => r.id));
  return state.staging
    .filter((r) => live.has(r.runId) || f.decision === 'rolled_back')
    .filter((r) => (f.decision && f.decision !== 'open' ? r.decision === f.decision : OPEN.includes(r.decision)))
    .filter((r) => !f.category || f.category === 'all' || r.category === f.category)
    .filter((r) => !f.issue || f.issue === 'all' || r.issues.includes(f.issue))
    .sort((a, b) => a.quality - b.quality || (a.name ?? '').localeCompare(b.name ?? ''));
}

export interface RunCounts {
  received: number;
  autoApproved: number;
  approved: number;
  needsReview: number;
  duplicates: number;
  rejected: number;
  merged: number;
}
export function runCounts(state: PoiAdminState, runId: string): RunCounts {
  const known = state.runs.find((r) => r.id === runId)?.counts;
  if (known) return known;
  const rs = state.staging.filter((r) => r.runId === runId);
  const n = (d: Decision) => rs.filter((r) => r.decision === d).length;
  return { received: rs.length, autoApproved: n('auto_approved'), approved: n('approved'), needsReview: n('needs_review'), duplicates: n('duplicate'), rejected: n('rejected'), merged: n('merged') };
}

export interface QualityMetrics {
  activePois: number;
  backlog: number;
  oldestBacklogRun: string | null;
  autoApprovePct: number;
  rejectPct: number;
  duplicatePct: number;
  completeness: { address: number; phone: number };
  byCategory: { category: PoiCategory; active: number; backlog: number }[];
}
const pct = (n: number, d: number) => (d ? Math.round((1000 * n) / d) / 10 : 0);

export function qualityMetrics(state: PoiAdminState): QualityMetrics {
  if (state.metrics) return state.metrics;
  const live = new Set(state.runs.filter((r) => r.status !== 'rolled_back').map((r) => r.id));
  const staged = state.staging.filter((r) => live.has(r.runId));
  const active = state.pois.filter((p) => p.status === 'active');
  const backlog = staged.filter((r) => OPEN.includes(r.decision));
  const oldest = backlog.map((r) => state.runs.find((x) => x.id === r.runId)?.startedAt).filter((x): x is string => Boolean(x)).sort()[0] ?? null;
  return {
    activePois: active.length,
    backlog: backlog.length,
    oldestBacklogRun: oldest,
    autoApprovePct: pct(staged.filter((r) => r.decision === 'auto_approved').length, staged.length),
    rejectPct: pct(staged.filter((r) => r.decision === 'rejected').length, staged.length),
    duplicatePct: pct(staged.filter((r) => r.issues.includes('pendua')).length, staged.length),
    completeness: { address: pct(active.filter((p) => p.address).length, active.length), phone: pct(active.filter((p) => p.phone).length, active.length) },
    byCategory: POI_CATEGORIES.map((c) => ({ category: c, active: active.filter((p) => p.category === c).length, backlog: backlog.filter((r) => r.category === c).length })),
  };
}
