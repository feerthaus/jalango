/**
 * ⚠️ TEST DATA ONLY (POI-2A). Not OpenStreetMap, not real businesses.
 *
 * Made-up records so the Admin → POI screens and the review workflow can be
 * built and tried before POI-1 has real OSM data and before any database
 * table exists (POI-2B). Names all start with "Contoh" and positions are
 * scattered around the Kuala Langat area at random: never use these numbers
 * for decisions about indexes, search speed or database size.
 */
import type { ImportRun, Issue, Poi, PoiAdminState, PoiCategory, StagingRecord } from '@/utils/poiReview';

export const IS_TEST_DATA = true;

/** Rough centres only, to spread the fake pins (Banting, Jenjarom, Telok Panglima Garang, Morib, Tanjung Sepat) */
const AREAS: [string, number, number][] = [
  ['Banting', 2.814, 101.502],
  ['Jenjarom', 2.873, 101.505],
  ['Telok Panglima Garang', 2.917, 101.553],
  ['Morib', 2.748, 101.443],
  ['Tanjung Sepat', 2.66, 101.56],
];

const NAMES: Record<PoiCategory, string[]> = {
  restoran: ['Contoh Restoran Selera', 'Contoh Warung Pagi', 'Contoh Kafe Senja', 'RESTORAN CONTOH JAYA', 'Kedai'],
  penginapan: ['Contoh Homestay Pantai', 'Contoh Rumah Tumpangan', 'Contoh Chalet Bakau'],
  minyak: ['Contoh Stesen Minyak A', 'Contoh Stesen Minyak B'],
  bengkel: ['Contoh Bengkel Kereta', 'Contoh Kedai Tayar', 'Contoh Bengkel Motor'],
  runcit: ['Contoh Kedai Runcit', 'Contoh Pasar Raya Mini', 'Contoh Kedai Serbaneka'],
  kesihatan: ['Contoh Klinik Keluarga', 'Contoh Farmasi', 'Contoh Klinik Gigi'],
  tarikan: ['Contoh Taman Rekreasi', 'Contoh Muzium Kecil'],
  ibadah: ['Contoh Masjid Kariah', 'Contoh Surau Taman', 'Surau'],
};

/** Small deterministic generator, so the test screens look the same every time */
function rng(seed: number) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

export function mockPoiState(): PoiAdminState {
  const r = rng(20261122);
  const runs: ImportRun[] = [
    { id: 'ujian-run-1', region: 'kuala-langat', source: 'osm (DATA UJIAN)', extractTimestamp: '2026-11-15T20:21:00Z', startedAt: '2026-11-16T18:43:00Z', finishedAt: '2026-11-16T18:47:00Z', status: 'processed' },
    { id: 'ujian-run-2', region: 'kuala-langat', source: 'osm (DATA UJIAN)', extractTimestamp: '2026-11-22T20:21:00Z', startedAt: '2026-11-23T18:43:00Z', finishedAt: '2026-11-23T18:48:00Z', status: 'processed' },
    { id: 'ujian-run-3', region: 'kuala-langat', source: 'osm (DATA UJIAN)', extractTimestamp: '2026-11-29T20:21:00Z', startedAt: '2026-11-30T18:43:00Z', finishedAt: '2026-11-30T18:45:00Z', status: 'held', note: 'Ditahan: akan menyembunyikan 7% POI aktif (had 5%). Menunggu semakan admin.' },
  ];
  const pois: Poi[] = [];
  const staging: StagingRecord[] = [];
  let n = 0;
  const cats = Object.keys(NAMES) as PoiCategory[];
  // Run 1: what earlier imports already made live
  for (const cat of cats) {
    for (const name of NAMES[cat].filter((x) => x.startsWith('Contoh')).slice(0, 2)) {
      const [area, lat, lng] = AREAS[Math.floor(r() * AREAS.length)];
      const id = `ujian-${++n}`;
      pois.push({ id: `poi:osm:${id}`, sourceRef: `osm:${id}`, name: `${name} ${area}`, category: cat, subcategory: null, lat: lat + (r() - 0.5) * 0.02, lng: lng + (r() - 0.5) * 0.02, address: r() > 0.5 ? `Jalan Contoh ${Math.ceil(r() * 9)}, ${area}` : null, phone: r() > 0.7 ? '+60300000000' : null, quality: 60 + Math.floor(r() * 30), status: 'active', firstRun: 'ujian-run-1', lastSeenRun: 'ujian-run-1' });
    }
  }
  // Run 2: a mix of decisions to review
  for (const cat of cats) {
    for (const base of NAMES[cat]) {
      const [area, lat, lng] = AREAS[Math.floor(r() * AREAS.length)];
      const id = `ujian-${++n}`;
      const issues: Issue[] = [];
      let name: string | null = base.startsWith('Contoh') || base === base.toUpperCase() ? `${base} ${area}` : base;
      if (r() < 0.08) { name = null; issues.push('nama_kosong'); }
      else if (/^(Kedai|Surau)$/.test(name)) issues.push('nama_generik');
      if (cat === 'runcit' && r() < 0.5) issues.push('pelbagai_kategori');
      const dup = r() < 0.2 ? pois.find((p) => p.category === cat) : undefined;
      if (dup) issues.push('pendua');
      const outside = r() < 0.05;
      if (outside) issues.push('koordinat_luar_julat');
      const quality = (name ? 30 : 0) + (issues.length ? 0 : 30) + Math.floor(r() * 40);
      const decision = !name || outside ? 'rejected' : dup ? 'duplicate' : issues.length === 0 && quality >= 60 ? 'auto_approved' : 'needs_review';
      staging.push({
        id, runId: 'ujian-run-2', sourceRef: `osm:${id}`, name, category: cat, subcategory: null,
        lat: dup ? dup.lat + 0.0002 : lat + (r() - 0.5) * 0.03, lng: dup ? dup.lng + 0.0001 : lng + (r() - 0.5) * 0.03,
        address: r() > 0.6 ? `Jalan Contoh ${Math.ceil(r() * 9)}, ${area}` : null, phone: r() > 0.75 ? '+60300000000' : null,
        quality: Math.min(100, quality), issues, decision, match: dup ? { poiId: dup.id, name: dup.name, metres: 24 } : null,
      });
    }
  }
  // Auto-approved records of run 2 are already live (as the real pipeline would do)
  const changes = staging.filter((s) => s.decision === 'auto_approved').map((s) => {
    const p: Poi = { id: `poi:${s.sourceRef}`, sourceRef: s.sourceRef, name: s.name!, category: s.category, subcategory: null, lat: s.lat, lng: s.lng, address: s.address, phone: s.phone, quality: s.quality, status: 'active', firstRun: s.runId, lastSeenRun: s.runId };
    pois.push(p);
    return { runId: s.runId, poiId: p.id, action: 'insert' as const, before: null, after: p, at: s.runId };
  });
  return { runs, staging, pois, changes, audit: [] };
}
