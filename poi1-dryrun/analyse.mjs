// POI-1 dry run: classify, clean, validate, find duplicates, sample, and size an
// OpenStreetMap extract of Kuala Langat. Input: osmium geojsonseq (with
// --add-unique-id=type_id and metadata). No database, no network.
import { readFileSync, writeFileSync } from 'node:fs';

const [, , input, boundaryFile, outDir] = process.argv;

// ── 8 categories (POI Intelligence Engine report §4) ───────────────────────
const CATS = [
  ['restoran', 'Restoran & kedai makan', (t) => ['restaurant', 'fast_food', 'cafe', 'food_court'].includes(t.amenity) || t.shop === 'bakery'],
  ['penginapan', 'Hotel & penginapan', (t) => ['hotel', 'motel', 'guest_house', 'hostel', 'chalet', 'apartment'].includes(t.tourism) || t.leisure === 'resort'],
  ['minyak', 'Stesen minyak', (t) => t.amenity === 'fuel'],
  ['bengkel', 'Bengkel & pusat servis', (t) => ['car_repair', 'tyres', 'motorcycle_repair'].includes(t.shop) || (t.shop === 'motorcycle' && t['service:vehicle:repair'] === 'yes') || t.amenity === 'car_wash'],
  ['runcit', 'Kedai runcit & pasar raya', (t) => ['convenience', 'supermarket', 'general', 'grocery', 'department_store'].includes(t.shop) || t.amenity === 'marketplace'],
  ['kesihatan', 'Klinik & farmasi', (t) => ['clinic', 'doctors', 'dentist', 'pharmacy', 'hospital'].includes(t.amenity) || t.shop === 'chemist' || Boolean(t.healthcare)],
  ['tarikan', 'Tarikan pelancongan', (t) => ['attraction', 'museum', 'viewpoint', 'theme_park', 'zoo', 'gallery'].includes(t.tourism) || (Boolean(t.historic) && Boolean(t.name)) || (t.natural === 'beach' && Boolean(t.name)) || (t.leisure === 'park' && Boolean(t.name))],
  ['ibadah', 'Masjid & surau', (t) => t.amenity === 'place_of_worship' && t.religion === 'muslim'],
];
const subcat = (c, t) => {
  if (c === 'restoran') return t.shop === 'bakery' ? 'bakeri' : { restaurant: 'restoran', fast_food: 'makanan segera', cafe: 'kafe', food_court: 'medan selera' }[t.amenity];
  if (c === 'penginapan') return t.leisure === 'resort' ? 'resort' : { hotel: 'hotel', motel: 'motel', guest_house: 'rumah tumpangan', hostel: 'hostel', chalet: 'chalet', apartment: 'apartmen' }[t.tourism];
  if (c === 'minyak') return (t.brand || t.operator || 'tanpa jenama').slice(0, 30);
  if (c === 'bengkel') return t.amenity === 'car_wash' ? 'cuci kereta' : { car_repair: 'bengkel kereta', tyres: 'tayar', motorcycle_repair: 'bengkel motosikal', motorcycle: 'bengkel motosikal' }[t.shop];
  if (c === 'runcit') return t.amenity === 'marketplace' ? 'pasar' : { convenience: 'kedai serbaneka', supermarket: 'pasar raya', general: 'kedai runcit', grocery: 'kedai runcit', department_store: 'gedung' }[t.shop];
  if (c === 'kesihatan') return t.shop === 'chemist' ? 'farmasi' : { clinic: 'klinik', doctors: 'klinik', dentist: 'klinik gigi', pharmacy: 'farmasi', hospital: 'hospital' }[t.amenity] ?? 'kesihatan';
  if (c === 'tarikan') return t.tourism ?? (t.historic ? 'bersejarah' : t.natural === 'beach' ? 'pantai' : 'taman');
  if (c === 'ibadah') return /\bsurau\b|musolla|musalla/i.test(t.name ?? '') ? 'surau' : 'masjid';
  return null;
};

// ── geometry helpers ───────────────────────────────────────────────────────
function centroid(g) {
  if (!g) return null;
  if (g.type === 'Point') return g.coordinates;
  const pts = [];
  const walk = (c) => (typeof c[0] === 'number' ? pts.push(c) : c.forEach(walk));
  walk(g.coordinates);
  if (!pts.length) return null;
  const s = pts.reduce((a, p) => [a[0] + p[0], a[1] + p[1]], [0, 0]);
  return [s[0] / pts.length, s[1] / pts.length];
}
function inRing(pt, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if (yi > pt[1] !== yj > pt[1] && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function inPolygons(pt, polys) {
  return polys.some((poly) => inRing(pt, poly[0]) && !poly.slice(1).some((hole) => inRing(pt, hole)));
}
const metres = (a, b) => Math.hypot((a[0] - b[0]) * 111320 * Math.cos((a[1] * Math.PI) / 180), (a[1] - b[1]) * 110574);

// ── cleaning (report §5) ───────────────────────────────────────────────────
const titleCase = (s) => s.toLowerCase().replace(/(^|[\s(/-])([a-z])/g, (m, p, c) => p + c.toUpperCase());
function cleanName(raw) {
  if (!raw) return null;
  let s = raw.replace(/\s+/g, ' ').trim();
  if (s.length > 6 && s === s.toUpperCase() && /[A-Z]{4}/.test(s)) s = titleCase(s); // ALL CAPS → Title Case
  return s;
}
const normName = (s) => (s ?? '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9 ]/g, ' ').replace(/\b(restoran|kedai|makan|cafe|kafe|masjid|surau|klinik|farmasi|hotel|the|sdn|bhd)\b/g, ' ').replace(/\s+/g, ' ').trim();
function cleanPhone(p) {
  if (!p) return null;
  const d = p.split(/[;,]/)[0].replace(/[^\d+]/g, '');
  const m = d.replace(/^\+?60/, '0');
  return /^0\d{8,10}$/.test(m) ? `+60${m.slice(1)}` : 'invalid';
}
const address = (t) => [t['addr:housenumber'], t['addr:street'], t['addr:city'] ?? t['addr:place'], t['addr:postcode']].filter(Boolean).join(', ') || null;

// ── load ───────────────────────────────────────────────────────────────────
const boundary = JSON.parse(readFileSync(boundaryFile, 'utf8'));
const polys = boundary.type === 'MultiPolygon' ? boundary.coordinates : [boundary.coordinates];
const subAreas = JSON.parse(readFileSync(boundaryFile.replace(/\.json$/, '-mukim.json'), 'utf8').toString() || '[]');
const feats = readFileSync(input, 'utf8').split('\n').map((l) => l.replace(/^\x1e/, '').trim()).filter(Boolean).map((l) => JSON.parse(l));

const recs = [];
const stats = { features_read: feats.length, outside_boundary: 0, not_in_8_categories: 0, invalid_geometry: 0 };
for (const f of feats) {
  const t = f.properties ?? {};
  const pt = centroid(f.geometry);
  if (!pt || !Number.isFinite(pt[0]) || !Number.isFinite(pt[1]) || Math.abs(pt[0]) > 180 || Math.abs(pt[1]) > 90) { stats.invalid_geometry++; continue; }
  const matches = CATS.filter(([, , test]) => test(t)).map(([id]) => id);
  if (!matches.length) { stats.not_in_8_categories++; continue; }
  if (!inPolygons(pt, polys)) { stats.outside_boundary++; continue; }
  const cat = matches[0];
  const name = cleanName(t.name ?? (cat === 'minyak' ? t.brand : null));
  const phone = cleanPhone(t.phone ?? t['contact:phone']);
  const mukim = subAreas.find((a) => inPolygons(pt, a.polys))?.name ?? '(tiada mukim)';
  const issues = [];
  if (!name) issues.push('nama_kosong');
  else if (name.length < 3) issues.push('nama_terlalu_pendek');
  if (name && /^(kedai|restoran|masjid|surau|klinik|shop|restaurant|cafe|hotel)$/i.test(name)) issues.push('nama_generik');
  if (matches.length > 1) issues.push('pelbagai_kategori');
  if (phone === 'invalid') issues.push('telefon_tidak_sah');
  if (pt[1] < 2.4 || pt[1] > 3.2 || pt[0] < 101.1 || pt[0] > 101.9) issues.push('koordinat_luar_julat');
  const addr = address(t);
  const quality = (name ? 30 : 0) + (matches.length === 1 ? 20 : 0) + (addr ? 15 : 0) + (phone && phone !== 'invalid' ? 10 : 0) + (t.opening_hours ? 10 : 0) + (t.brand ? 5 : 0) + (issues.length === 0 ? 10 : 0);
  recs.push({
    source_ref: `osm:${f.id ?? t['@id']}`,
    osm_url: `https://www.openstreetmap.org/${String(f.id ?? '').replace(/^([nwr])/, (m) => ({ n: 'node/', w: 'way/', r: 'relation/' })[m])}`,
    version: t['@version'] ?? null, timestamp: t['@timestamp'] ?? null,
    category: cat, subcategory: subcat(cat, t) ?? null, also: matches.slice(1),
    name, name_norm: normName(name), raw_name: t.name ?? null,
    lat: Math.round(pt[1] * 1e6) / 1e6, lng: Math.round(pt[0] * 1e6) / 1e6,
    geom: f.geometry.type, mukim, address: addr,
    phone: phone === 'invalid' ? null : phone, website: t.website ?? t['contact:website'] ?? null,
    opening_hours: t.opening_hours ?? null, brand: t.brand ?? null,
    issues, quality,
  });
}

// ── duplicates (report §5): same normalised name + category within 50 m ───
const dupPairs = [];
for (let i = 0; i < recs.length; i++) for (let j = i + 1; j < recs.length; j++) {
  const a = recs[i], b = recs[j];
  if (a.category !== b.category || !a.name_norm || a.name_norm !== b.name_norm) continue;
  const d = metres([a.lng, a.lat], [b.lng, b.lat]);
  if (d <= 50) { dupPairs.push({ a: a.source_ref, b: b.source_ref, name: a.name, metres: Math.round(d) }); b.issues.push('pendua'); b.duplicate_of = a.source_ref; }
}
// same name, same category, 50–300 m: likely branches or mapping errors, flag for review
const nearPairs = [];
for (let i = 0; i < recs.length; i++) for (let j = i + 1; j < recs.length; j++) {
  const a = recs[i], b = recs[j];
  if (a.category !== b.category || !a.name_norm || a.name_norm !== b.name_norm) continue;
  const d = metres([a.lng, a.lat], [b.lng, b.lat]);
  if (d > 50 && d <= 300) nearPairs.push({ a: a.source_ref, b: b.source_ref, name: a.name, metres: Math.round(d) });
}

// ── decisions as POI-2 would make them ─────────────────────────────────────
for (const r of recs) {
  const hard = r.issues.includes('nama_kosong') || r.issues.includes('koordinat_luar_julat');
  r.decision = hard ? 'rejected' : r.issues.includes('pendua') ? 'duplicate' : r.issues.length === 0 && r.quality >= 60 ? 'auto_approved' : 'needs_review';
  r.low_quality = r.quality < 40;
}

// ── summaries ──────────────────────────────────────────────────────────────
const by = (key) => recs.reduce((m, r) => ((m[r[key]] = (m[r[key]] ?? 0) + 1), m), {});
const pct = (n, d) => (d ? Math.round((1000 * n) / d) / 10 : 0);
const catSummary = CATS.map(([id, label]) => {
  const rs = recs.filter((r) => r.category === id);
  return {
    id, label, total: rs.length,
    named: rs.filter((r) => r.name).length,
    with_address: rs.filter((r) => r.address).length,
    with_phone: rs.filter((r) => r.phone).length,
    with_hours: rs.filter((r) => r.opening_hours).length,
    auto_approved: rs.filter((r) => r.decision === 'auto_approved').length,
    needs_review: rs.filter((r) => r.decision === 'needs_review').length,
    rejected: rs.filter((r) => r.decision === 'rejected').length,
    duplicate: rs.filter((r) => r.decision === 'duplicate').length,
    avg_quality: rs.length ? Math.round(rs.reduce((s, r) => s + r.quality, 0) / rs.length) : 0,
    subcategories: rs.reduce((m, r) => ((m[r.subcategory ?? '?'] = (m[r.subcategory ?? '?'] ?? 0) + 1), m), {}),
    newest_edit: rs.map((r) => r.timestamp).filter(Boolean).sort().at(-1) ?? null,
    oldest_edit: rs.map((r) => r.timestamp).filter(Boolean).sort()[0] ?? null,
  };
});
const mukimSummary = Object.entries(by('mukim')).sort((a, b) => b[1] - a[1]).map(([mukim, n]) => ({
  mukim, total: n,
  per_category: Object.fromEntries(CATS.map(([id]) => [id, recs.filter((r) => r.mukim === mukim && r.category === id).length])),
}));
const issueCounts = recs.flatMap((r) => r.issues).reduce((m, k) => ((m[k] = (m[k] ?? 0) + 1), m), {});

// ── 50 samples: every category, spread over mukim, mix of decisions ───────
function seeded(seed) { let s = seed; return () => ((s = (s * 1103515245 + 12345) % 2 ** 31) / 2 ** 31); }
const rnd = seeded(20261122);
const shuffled = [...recs].sort(() => rnd() - 0.5);
const sample = [];
const take = (r) => { if (r && !sample.includes(r) && sample.length < 50) sample.push(r); };
const live = CATS.map(([id]) => id).filter((id) => recs.some((r) => r.category === id));
const perCat = Math.max(1, Math.floor(50 / Math.max(1, live.length)));
for (const id of live) {
  const pool = shuffled.filter((r) => r.category === id);
  const mukims = [...new Set(pool.map((r) => r.mukim))];
  // round-robin over mukim, then a review/rejected case if any
  for (let k = 0; sample.filter((r) => r.category === id).length < perCat && k < pool.length; k++) take(pool.filter((r) => r.mukim === mukims[k % mukims.length] && !sample.includes(r))[0] ?? pool[k]);
}
for (const r of shuffled.filter((x) => x.decision !== 'auto_approved')) if (sample.filter((x) => x.decision !== 'auto_approved').length < 12) take(r);
for (const r of shuffled) take(r);

// ── PostgreSQL size estimate (pois table, report §6) ───────────────────────
// Heap: 24 B tuple header + ~100 B fixed columns (uuid, 2×float8, ints, timestamps,
// status) + text bytes (+1–4 B each) + 4 B line pointer, rounded to 8 B; pages
// ~90% full. Indexes: primary key uuid (~ 40 B/row), unique source_ref (~ text+16),
// btree (lat,lng) (~ 40 B), GIN trigram on name_norm (~ 3 trigrams per char × ~10 B).
const textBytes = (r) => [r.source_ref, r.category, r.subcategory, r.name, r.name_norm, r.address, r.phone, r.website, r.opening_hours, r.brand, r.mukim].reduce((s, v) => s + (v ? Buffer.byteLength(String(v)) + 1 : 0), 0);
const rowHeap = (r) => Math.ceil((24 + 100 + textBytes(r)) / 8) * 8 + 4;
const n = recs.length || 1;
const avgHeap = recs.reduce((s, r) => s + rowHeap(r), 0) / n;
const avgName = recs.reduce((s, r) => s + (r.name_norm?.length ?? 0), 0) / n;
const perRow = {
  heap: avgHeap / 0.9,
  pk_uuid: 40,
  unique_source_ref: 24 + 18,
  btree_lat_lng: 40,
  gin_trgm_name: Math.max(30, avgName * 3 * 10),
  history_and_staging: (avgHeap / 0.9) * 0.5, // poi_changes (first insert) + poi_staging kept 90 days
};
const totalPerRow = Object.values(perRow).reduce((a, b) => a + b, 0);
const size = {
  rows: recs.length,
  per_row_bytes: Object.fromEntries(Object.entries(perRow).map(([k, v]) => [k, Math.round(v)])),
  total_per_row_bytes: Math.round(totalPerRow),
  kuala_langat_kb: Math.round((recs.length * totalPerRow) / 1024),
  scale: Object.fromEntries([['selangor_x', 15], ['malaysia_100k', 100000], ['malaysia_300k', 300000]].map(([k, v]) => [k, k.endsWith('_x') ? `${Math.round((recs.length * v * totalPerRow) / 1048576)} MB (×${v} Kuala Langat)` : `${Math.round((v * totalPerRow) / 1048576)} MB`])),
};

const result = { generated_for: 'POI-1 dry run, Kuala Langat', stats: { ...stats, in_8_categories_inside_boundary: recs.length }, by_category: catSummary, by_mukim: mukimSummary, issues: issueCounts, decisions: by('decision'), low_quality: recs.filter((r) => r.low_quality).length, duplicates_within_50m: dupPairs, same_name_50_300m: nearPairs, size };
writeFileSync(`${outDir}/summary.json`, JSON.stringify(result, null, 2));
writeFileSync(`${outDir}/records.json`, JSON.stringify(recs, null, 1));
const csvEsc = (v) => (v == null ? '' : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
const cols = ['no', 'category', 'subcategory', 'name', 'mukim', 'lat', 'lng', 'address', 'phone', 'decision', 'quality', 'issues', 'osm_url', 'google_maps_check', 'betul_lokasi (Y/T)', 'betul_kategori (Y/T)', 'masih_beroperasi (Y/T/?)', 'nota'];
const rows = sample.map((r, i) => [i + 1, r.category, r.subcategory, r.name, r.mukim, r.lat, r.lng, r.address, r.phone, r.decision, r.quality, r.issues.join(' '), r.osm_url, `https://www.google.com/maps?q=${r.lat},${r.lng}`, '', '', '', '']);
writeFileSync(`${outDir}/sample50.csv`, [cols, ...rows].map((r) => r.map(csvEsc).join(',')).join('\n') + '\n');
console.log(JSON.stringify({ records: recs.length, decisions: result.decisions, issues: issueCounts, sample: sample.length, size: size.kuala_langat_kb + ' kB' }));
