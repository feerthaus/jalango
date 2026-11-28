// POI-5 dry run report for a new region (no database). Prints to the log, so the
// owner can review it in the workflow run, and writes a 50-record sample CSV for
// the accuracy audit (≥ 90 % right before any import, as for Kuala Langat).
//
//   node scripts/poi/region-report.mjs out/staging.json out/boundary-mukim.json out/region-sample.csv
import { readFileSync, writeFileSync } from 'node:fs';

const [, , stagingFile, partsFile, sampleFile] = process.argv;
const rows = JSON.parse(readFileSync(stagingFile, 'utf8'));
const parts = JSON.parse(readFileSync(partsFile, 'utf8'));

const inRing = (pt, ring) => { let c = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, yi] = ring[i], [xj, yj] = ring[j]; if (yi > pt[1] !== yj > pt[1] && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) c = !c; } return c; };
const inPolys = (pt, polys) => polys.some((p) => inRing(pt, p[0]) && !p.slice(1).some((h) => inRing(pt, h)));
const areaOf = (r) => parts.find((d) => inPolys([r.lng, r.lat], d.polys))?.name ?? '(tiada daerah OSM)';

const count = (xs, key) => xs.reduce((m, x) => ((m[key(x)] = (m[key(x)] ?? 0) + 1), m), {});
const sorted = (m) => Object.fromEntries(Object.entries(m).sort((a, b) => b[1] - a[1]));
const pct = (n, d) => (d ? `${Math.round((1000 * n) / d) / 10}%` : '0%');

for (const r of rows) r.area = areaOf(r);
const live = rows.filter((r) => r.decision === 'auto_approved');
const out = {
  rows: rows.length,
  by_decision: sorted(count(rows, (r) => r.decision)),
  rejected_by_reason: sorted(count(rows.filter((r) => r.decision === 'rejected'), (r) => r.reject_reason ?? '-')),
  by_category_auto: sorted(count(live, (r) => r.category)),
  stale: pct(rows.filter((r) => r.issues?.includes('data_lapuk')).length, rows.length),
  with_address: pct(live.filter((r) => r.address).length, live.length),
  with_phone: pct(live.filter((r) => r.phone).length, live.length),
  // pois rows are ~1 KB with indexes; staging ~1.5 KB (kept 90 days)
  storage_estimate_mb: { pois: Math.round((live.length * 1.0) / 1024 * 10) / 10, staging_per_run: Math.round((rows.length * 1.5) / 1024 * 10) / 10 },
};
console.log('=====SUMMARY=====');
console.log(JSON.stringify(out, null, 1));
console.log('=====BY_AREA (rows / auto / review / rejected / duplicate)=====');
const areas = [...new Set(rows.map((r) => r.area))].sort();
for (const a of areas) {
  const rs = rows.filter((r) => r.area === a);
  const n = (d) => rs.filter((r) => r.decision === d).length;
  console.log(`${a} | ${rs.length} / ${n('auto_approved')} / ${n('needs_review')} / ${n('rejected')} / ${n('duplicate')}`);
}

// Sample: 50 auto-approved records, spread over areas and categories, fixed seed
let seed = 20261128;
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
const pool = [...live].sort((a, b) => a.osm_ref.localeCompare(b.osm_ref));
const sample = [];
const byKey = new Map();
for (const r of pool) { const k = `${r.area}|${r.category}`; if (!byKey.has(k)) byKey.set(k, []); byKey.get(k).push(r); }
const groups = [...byKey.values()];
while (sample.length < 50 && groups.some((g) => g.length)) {
  for (const g of groups) {
    if (!g.length || sample.length >= 50) continue;
    if (rand() < 0.5) continue;
    sample.push(g.splice(Math.floor(rand() * g.length), 1)[0]);
  }
}
const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
const header = ['no', 'osm_ref', 'nama', 'kategori', 'subkategori', 'daerah', 'tempat_terdekat', 'lat', 'lng', 'peta_osm', 'lokasi_betul (Y/T)', 'kategori_betul (Y/T)', 'masih_wujud (Y/T/?)', 'nota'];
const csv = [header.join(','), ...sample.map((r, i) => [i + 1, r.osm_ref, r.name, r.category, r.subcategory, r.area, r.nearest_place, r.lat.toFixed(6), r.lng.toFixed(6), `https://www.openstreetmap.org/${r.osm_ref}`, '', '', '', ''].map(esc).join(','))].join('\n');
writeFileSync(sampleFile, csv + '\n');
console.log('=====SAMPLE_50 (for the owner audit)=====');
sample.forEach((r, i) => console.log(`${i + 1}. ${r.osm_ref} | ${r.name} | ${r.category}/${r.subcategory ?? ''} | ${r.area} | ${r.nearest_place ?? '-'} | ${r.lat.toFixed(5)},${r.lng.toFixed(5)}`));
console.log('=====END=====');
