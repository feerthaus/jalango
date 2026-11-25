import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createMockPoiAdminService, createSupabasePoiAdminService, stateFromAdmin } from './poiAdminService';
import { qualityMetrics, reviewQueue, runCounts } from '@/utils/poiReview';

describe('mock POI admin service (test data)', () => {
  it('says it is test data, only uses "Contoh" names, and runs the workflow end to end', async () => {
    const svc = createMockPoiAdminService('ujian', () => '2026-11-22T10:00:00Z');
    expect(svc.testData).toBe(true);
    const s0 = await svc.load();
    expect([...s0.pois, ...s0.staging].every((x) => x.name === null || /contoh/i.test(x.name) || /^(Kedai|Surau)$/.test(x.name))).toBe(true);
    const open = reviewQueue(s0);
    expect(open.length).toBeGreaterThan(0);
    const named = open.find((r) => r.name && !r.issues.includes('koordinat_luar_julat') && !r.issues.includes('nama_generik') && r.decision === 'needs_review')!;
    const s1 = await svc.approve(named.id);
    expect(s1.pois.some((p) => p.sourceRef === named.sourceRef)).toBe(true);
    const s2 = await svc.rollback(named.runId);
    expect(s2.pois.some((p) => p.sourceRef === named.sourceRef)).toBe(false);
    const s3 = await svc.reset();
    expect(s3.runs.every((r) => r.status !== 'rolled_back')).toBe(true);
  });
});

describe('Supabase POI admin service (POI-2B)', () => {
  const json = {
    runs: [{ id: 'r1', region: 'kuala-langat', source: 'osm', extract_timestamp: '2026-11-22T21:20:48Z', started_at: '2026-11-23T10:00:00Z', finished_at: '2026-11-23T10:05:00Z', status: 'processed' as const, note: null, counts: { rows: 619, auto_approved: 500, needs_review: 40, rejected: 59, duplicate: 20 } }],
    queue: [
      { id: 's1', run_id: 'r1', osm_ref: 'node/900', name: 'Surau', category: 'ibadah' as const, subcategory: 'surau', lat: 2.81, lng: 101.5, address: null, phone: null, quality: 50, issues: ['nama_generik'], decision: 'needs_review' as const, reject_reason: null, match_poi_id: null, reviewed_by: null, reviewed_at: null },
      { id: 's2', run_id: 'r1', osm_ref: 'node/902', name: 'Restoran K2', category: 'restoran' as const, subcategory: 'restoran', lat: 2.8101, lng: 101.5, address: null, phone: null, quality: 60, issues: ['pendua'], decision: 'duplicate' as const, reject_reason: null, match_poi_id: 'p1', reviewed_by: null, reviewed_at: null },
    ],
    matches: [{ id: 'p1', osm_ref: 'node/901', name: 'Restoran K2', category: 'restoran' as const, subcategory: 'restoran', lat: 2.81, lng: 101.5, address: 'Banting', phone: null, quality: 75, status: 'active' as const, first_run: 'r1', last_seen_run: 'r1' }],
    metrics: { active: 500, hidden: 3, needs_check: 120, with_address: 150, with_phone: 50, with_hours: 40, by_category: { restoran: 200, ibadah: 80 }, open_feedback: 0 },
    changes: [{ id: 2, run_id: 'r1', poi_id: 'p1', action: 'approve', reason: null, at: '2026-11-23T11:00:00Z', name: 'Restoran K2' }, { id: 1, run_id: 'r1', poi_id: 'p1', action: 'insert', reason: null, at: '2026-11-23T10:05:00Z', name: 'Restoran K2' }],
  };

  it('maps the database view to the screen state, with whole-run counts and metrics', () => {
    const s = stateFromAdmin(json);
    expect(reviewQueue(s).map((r) => r.id).sort()).toEqual(['s1', 's2']);
    expect(s.staging.find((r) => r.id === 's2')!.match).toEqual({ poiId: 'p1', name: 'Restoran K2', metres: 11 });
    expect(runCounts(s, 'r1')).toMatchObject({ received: 619, autoApproved: 500, needsReview: 1, duplicates: 1, rejected: 59 });
    const m = qualityMetrics(s);
    expect(m.activePois).toBe(500);
    expect(m.completeness.address).toBe(30);
    expect(m.byCategory.find((c) => c.category === 'restoran')).toEqual({ category: 'restoran', active: 200, backlog: 1 });
    expect(s.audit).toEqual([{ at: '2026-11-23T11:00:00Z', actor: 'admin', action: 'approve', target: 'Restoran K2', note: '' }]);
  });

  it('calls the database functions and explains refusals in Malay', async () => {
    const calls: [string, unknown][] = [];
    const db = {
      rpc: async (fn: string, args?: unknown) => {
        calls.push([fn, args]);
        if (fn === 'admin_poi_state') return { data: json, error: null };
        if (fn === 'poi_review' && (args as { p_name: string | null }).p_name === null) return { data: null, error: { message: 'Give this place its real name before approving.', hint: 'nama_generik' } };
        return { data: null, error: null };
      },
    } as unknown as SupabaseClient;
    const svc = createSupabasePoiAdminService(db);
    expect(svc.testData).toBe(false);
    await expect(svc.approve('s1')).rejects.toThrow('Nama generik');
    await svc.approve('s1', 'ibadah', 'Surau Haji Saliman');
    await svc.merge('s2', 'p1');
    await svc.rollback('r1');
    await svc.rename('p1', 'Restoran K2 Banting', 'restoran');
    await svc.setHidden('p1', true, ' Pendua ');
    await svc.setHidden('p1', false);
    expect(calls.filter(([fn]) => fn !== 'admin_poi_state')).toEqual([
      ['poi_review', { p_id: 's1', p_action: 'approve', p_category: null, p_name: null }],
      ['poi_review', { p_id: 's1', p_action: 'approve', p_category: 'ibadah', p_name: 'Surau Haji Saliman' }],
      ['poi_merge', { p_id: 's2', p_into: 'p1' }],
      ['poi_rollback_run', { p_run: 'r1' }],
      ['poi_rename', { p_poi: 'p1', p_name: 'Restoran K2 Banting', p_category: 'restoran' }],
      ['poi_set_hidden', { p_poi: 'p1', p_hidden: true, p_reason: 'Pendua' }],
      ['poi_set_hidden', { p_poi: 'p1', p_hidden: false, p_reason: null }],
    ]);
  });

  it('searches live POIs and maps the admin flags', async () => {
    const row = { ...json.matches[0], status: 'hidden' as const, admin_override: true, hidden_by_admin: true };
    const db = { rpc: async (fn: string) => (fn === 'admin_poi_search' ? { data: [row], error: null } : { data: json, error: null }) } as unknown as SupabaseClient;
    const [p] = await createSupabasePoiAdminService(db).searchLive('k2');
    expect(p).toMatchObject({ id: 'p1', name: 'Restoran K2', liveStatus: 'hidden', status: 'hidden', adminOverride: true, hiddenByAdmin: true });
  });

  it('shows admin edits of live POIs in the audit log', () => {
    const s = stateFromAdmin({
      ...json,
      changes: [
        { id: 5, run_id: null, poi_id: 'p1', action: 'update', reason: 'admin: papar semula', at: '2026-11-25T12:00:00Z', name: 'Restoran K2' },
        { id: 4, run_id: null, poi_id: 'p1', action: 'hide', reason: 'Pendua', at: '2026-11-25T11:00:00Z', name: 'Restoran K2' },
        { id: 3, run_id: null, poi_id: 'p1', action: 'update', reason: 'admin: nama/kategori', at: '2026-11-25T10:00:00Z', name: 'Restoran K2' },
      ],
    });
    expect(s.audit.map((a) => [a.action, a.note])).toEqual([['rename', ''], ['hide', 'Pendua'], ['show', '']]);
  });
});
