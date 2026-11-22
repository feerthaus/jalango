import { describe, expect, it } from 'vitest';
import { createMockPoiAdminService } from './poiAdminService';
import { reviewQueue } from '@/utils/poiReview';

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
