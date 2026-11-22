import { describe, expect, it } from 'vitest';
import { approveRecord, mergeDuplicate, PoiReviewError, qualityMetrics, rejectRecord, reviewQueue, rollbackRun, runCounts, type PoiAdminState, type StagingRecord } from './poiReview';

const AT = '2026-11-22T10:00:00Z';
const rec = (id: string, over: Partial<StagingRecord> = {}): StagingRecord => ({
  id, runId: 'run-2', sourceRef: `osm:n${id}`, name: `Tempat Ujian ${id}`, category: 'restoran', subcategory: 'restoran',
  lat: 2.8, lng: 101.5, address: null, phone: null, quality: 50, issues: [], decision: 'needs_review', match: null, ...over,
});
const base = (): PoiAdminState => ({
  runs: [
    { id: 'run-1', region: 'kuala-langat', source: 'osm', extractTimestamp: AT, startedAt: '2026-11-15T18:00:00Z', finishedAt: AT, status: 'processed' },
    { id: 'run-2', region: 'kuala-langat', source: 'osm', extractTimestamp: AT, startedAt: '2026-11-22T18:00:00Z', finishedAt: AT, status: 'processed' },
  ],
  staging: [
    rec('1'),
    rec('2', { name: null, issues: ['nama_kosong'], decision: 'rejected' }),
    rec('3', { issues: ['pendua'], decision: 'duplicate', match: { poiId: 'poi:old', name: 'Kedai Lama', metres: 20 }, phone: '+60331111111' }),
    rec('4', { decision: 'auto_approved', quality: 80 }),
    rec('5', { quality: 20, category: 'bengkel' }),
  ],
  pois: [{ id: 'poi:old', sourceRef: 'osm:nold', name: 'Kedai Lama', category: 'restoran', subcategory: null, lat: 2.8, lng: 101.5, address: 'Jalan Ujian', phone: null, quality: 60, status: 'active', firstRun: 'run-1', lastSeenRun: 'run-1' }],
  changes: [],
  audit: [],
});

describe('POI review workflow', () => {
  it('approves a record into a live POI, optionally re-categorised, with change and audit', () => {
    const s = approveRecord(base(), '1', 'admin', AT, 'penginapan');
    expect(s.pois.find((p) => p.sourceRef === 'osm:n1')).toMatchObject({ category: 'penginapan', status: 'active', firstRun: 'run-2' });
    expect(s.staging.find((r) => r.id === '1')).toMatchObject({ decision: 'approved', reviewedBy: 'admin', category: 'penginapan' });
    expect(s.changes).toHaveLength(1);
    expect(s.audit.map((a) => a.action)).toEqual(['approve', 'recategorise']);
  });
  it('refuses unsafe or repeated decisions', () => {
    const s = approveRecord(base(), '1', 'admin', AT);
    expect(() => approveRecord(s, '1', 'admin', AT)).toThrow(PoiReviewError);
    expect(() => approveRecord(base(), '2', 'admin', AT)).toThrow(/sudah diputuskan/);
    const noName = { ...base(), staging: [rec('9', { name: null })] };
    expect(() => approveRecord(noName, '9', 'admin', AT)).toThrow(/tanpa nama/);
    const outside = { ...base(), staging: [rec('9', { issues: ['koordinat_luar_julat'] })] };
    expect(() => approveRecord(outside, '9', 'admin', AT)).toThrow(/luar kawasan/);
    expect(() => rejectRecord(base(), '1', 'admin', AT, '  ')).toThrow(/sebab/);
  });
  it('needs a real name before approving a generic one, and logs the rename', () => {
    const st = { ...base(), staging: [rec('9', { name: 'Surau', issues: ['nama_generik'] })] };
    expect(() => approveRecord(st, '9', 'admin', AT)).toThrow(/Nama generik/);
    expect(() => approveRecord(st, '9', 'admin', AT, undefined, 'Su')).toThrow(/terlalu pendek/);
    const s = approveRecord(st, '9', 'admin', AT, undefined, '  Surau   Al-Ikhlas ');
    expect(s.pois[1].name).toBe('Surau Al-Ikhlas');
    expect(s.audit.map((a) => a.action)).toEqual(['approve', 'rename']);
  });
  it('rejects with a reason', () => {
    const s = rejectRecord(base(), '5', 'admin', AT, 'Bukan bengkel');
    expect(s.staging.find((r) => r.id === '5')).toMatchObject({ decision: 'rejected', rejectReason: 'Bukan bengkel' });
    expect(s.pois).toHaveLength(1);
  });
  it('merges a duplicate into the existing POI, filling only missing details', () => {
    const s = mergeDuplicate(base(), '3', 'poi:old', 'admin', AT);
    const p = s.pois.find((x) => x.id === 'poi:old')!;
    expect(p).toMatchObject({ address: 'Jalan Ujian', phone: '+60331111111', lastSeenRun: 'run-2' });
    expect(s.pois).toHaveLength(1);
    expect(s.staging.find((r) => r.id === '3')!.decision).toBe('merged');
  });
  it('rolls a run back: inserts removed, updates restored, records closed', () => {
    let s = approveRecord(base(), '1', 'admin', AT);
    s = mergeDuplicate(s, '3', 'poi:old', 'admin', AT);
    s = rollbackRun(s, 'run-2', 'admin', AT);
    expect(s.pois).toEqual(base().pois);
    expect(s.changes).toHaveLength(0);
    expect(s.runs.find((r) => r.id === 'run-2')!.status).toBe('rolled_back');
    expect(s.staging.filter((r) => r.decision === 'rolled_back').map((r) => r.id)).toEqual(['1', '3', '4', '5']);
    expect(() => approveRecord(s, '5', 'admin', AT)).toThrow();
    expect(() => rollbackRun(s, 'run-2', 'admin', AT)).toThrow(/sudah di-rollback/);
    expect(s.audit.at(-1)).toMatchObject({ action: 'rollback', note: '2 perubahan dikembalikan' });
  });
  it('lists open records lowest quality first, with filters', () => {
    expect(reviewQueue(base()).map((r) => r.id)).toEqual(['5', '1', '3']);
    expect(reviewQueue(base(), { category: 'bengkel' }).map((r) => r.id)).toEqual(['5']);
    expect(reviewQueue(base(), { issue: 'pendua' }).map((r) => r.id)).toEqual(['3']);
    expect(reviewQueue(base(), { decision: 'rejected' }).map((r) => r.id)).toEqual(['2']);
  });
  it('counts a run and measures quality', () => {
    expect(runCounts(base(), 'run-2')).toMatchObject({ received: 5, autoApproved: 1, needsReview: 2, duplicates: 1, rejected: 1 });
    const m = qualityMetrics(approveRecord(base(), '1', 'admin', AT));
    expect(m).toMatchObject({ activePois: 2, backlog: 2, autoApprovePct: 20, rejectPct: 20, duplicatePct: 20 });
    expect(m.completeness.address).toBe(50);
    expect(m.byCategory.find((c) => c.category === 'bengkel')).toEqual({ category: 'bengkel', active: 0, backlog: 1 });
  });
});
