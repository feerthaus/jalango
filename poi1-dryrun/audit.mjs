// POI-1 audit evidence (read-only): full OSM tags, last edit, surroundings and
// boundary distance for the 50 audited samples, plus the full lists of unnamed
// places of worship and food places inside institutions.
// Usage: node audit.mjs audit-ids.json poi.geojsonseq ctx.geojsonseq out/boundary.json out/records.json out
import { readFileSync, writeFileSync } from 'node:fs';
const [, , idsFile, poiFile, ctxFile, boundaryFile, recordsFile, out] = process.argv;
const lines = (f) => { try { return readFileSync(f, 'utf8').split('\n').map((l) => l.replace(/^\x1e/, '').trim()).filter(Boolean).map((l) => JSON.parse(l)); } catch { return []; } };
const ids = JSON.parse(readFileSync(idsFile, 'utf8'));
const feats = lines(poiFile);
const ctx = lines(ctxFile).filter((f) => f.geometry && /Polygon/.test(f.geometry.type));
const boundary = JSON.parse(readFileSync(boundaryFile, 'utf8'));
const recs = JSON.parse(readFileSync(recordsFile, 'utf8'));

// osmium ids: n123 / w123 (as line) / a246 (way 123 as area) / a247 (relation 123 as area)
const key = (f) => {
  const id = String(f.id ?? '');
  const m = id.match(/^([nwra])(\d+)$/); if (!m) return null;
  if (m[1] !== 'a') return m[1] + m[2];
  const a = BigInt(m[2]); return (a % 2n === 0n ? 'w' + (a / 2n) : 'r' + ((a - 1n) / 2n));
};
const byKey = new Map();
for (const f of feats) { const k = key(f); if (!k) continue; const prev = byKey.get(k); if (!prev || /Polygon/.test(f.geometry?.type ?? '')) byKey.set(k, f); }
const osmUrl = (k) => `https://www.openstreetmap.org/${{ n: 'node', w: 'way', r: 'relation' }[k[0]]}/${k.slice(1)}`;
const refKey = (ref) => { const k = key({ id: ref.replace(/^osm:/, '') }); return k; };

const inRing = (pt, ring) => { let c = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, yi] = ring[i], [xj, yj] = ring[j]; if (yi > pt[1] !== yj > pt[1] && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) c = !c; } return c; };
const polysOf = (g) => (g.type === 'MultiPolygon' ? g.coordinates : [g.coordinates]);
const inPoly = (pt, g) => polysOf(g).some((p) => inRing(pt, p[0]) && !p.slice(1).some((h) => inRing(pt, h)));
const segDist = (pt, a, b) => {
  const k = 111320 * Math.cos((pt[1] * Math.PI) / 180), q = 110574;
  const ax = (a[0] - pt[0]) * k, ay = (a[1] - pt[1]) * q, bx = (b[0] - pt[0]) * k, by = (b[1] - pt[1]) * q;
  const dx = bx - ax, dy = by - ay, len = dx * dx + dy * dy;
  const t = len ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len)) : 0;
  return Math.hypot(ax + t * dx, ay + t * dy);
};
const edgeDist = (pt, g) => { let best = Infinity; for (const p of polysOf(g)) for (const ring of p) for (let i = 1; i < ring.length; i++) best = Math.min(best, segDist(pt, ring[i - 1], ring[i])); return best; };
const ctxLabel = (t) => [t.name, t.amenity && `amenity=${t.amenity}`, t.landuse && `landuse=${t.landuse}`, t.office && `office=${t.office}`, t.military && `military=${t.military}`].filter(Boolean).join(' · ');
const surroundings = (pt) => ctx.filter((c) => inPoly(pt, c.geometry)).map((c) => ctxLabel(c.properties ?? {})).slice(0, 3);
const iso = (ts) => (ts ? new Date(Number(ts) * 1000).toISOString().slice(0, 10) : null);
const lifecycle = (t) => Object.keys(t).filter((k) => /^(disused|abandoned|was|demolished|removed|construction|proposed):/.test(k) || ['disused', 'abandoned'].includes(k)).map((k) => `${k}=${t[k]}`);
const plainTags = (t) => Object.fromEntries(Object.entries(t).filter(([k]) => !k.startsWith('@')));

// ── the 50 samples ──────────────────────────────────────────────────────
const samples = ids.map((s) => {
  const k = s.type + s.id;
  const f = byKey.get(k);
  const pt = [s.lng, s.lat];
  const t = f?.properties ?? {};
  return {
    no: s.no, osm: k, osm_url: osmUrl(k), name: s.name, category: s.category, lat: s.lat, lng: s.lng,
    found_in_current_data: Boolean(f),
    tags: plainTags(t),
    version: t['@version'] ?? null, last_edit: iso(t['@timestamp']),
    check_date: t.check_date ?? t['check_date:opening_hours'] ?? null,
    lifecycle_tags: lifecycle(t),
    inside_boundary: inPoly(pt, boundary), metres_to_boundary: Math.round(edgeDist(pt, boundary)),
    surroundings: surroundings(pt),
  };
});

// ── all unnamed places of worship, and food places inside institutions ──
const featOf = (r) => byKey.get(refKey(r.source_ref));
const unnamedWorship = recs.filter((r) => r.category === 'ibadah' && !r.name).map((r) => {
  const t = featOf(r)?.properties ?? {}; const k = refKey(r.source_ref);
  return { osm: k, osm_url: osmUrl(k), subcategory: r.subcategory, lat: r.lat, lng: r.lng, religion: t.religion ?? null, building: t.building ?? null, last_edit: iso(t['@timestamp']), surroundings: surroundings([r.lng, r.lat]).join(' | '), nearest_place: r.nearest_place ?? null };
});
const INSTITUTION = /kantin|canteen|cafeteria|dewan makan|dining hall|asrama|hostel ikbn/i;
const institutionalFood = recs.filter((r) => ['restoran', 'penginapan'].includes(r.category)).map((r) => ({ r, around: surroundings([r.lng, r.lat]) }))
  .filter(({ r, around }) => INSTITUTION.test(r.name ?? '') || around.some((a) => /school|college|university|kindergarten|military|prison|education|government/.test(a)))
  .map(({ r, around }) => { const t = featOf(r)?.properties ?? {}; const k = refKey(r.source_ref); return { osm: k, osm_url: osmUrl(k), name: r.name, category: r.category, subcategory: r.subcategory, lat: r.lat, lng: r.lng, access: t.access ?? null, last_edit: iso(t['@timestamp']), surroundings: around.join(' | ') }; });

const csv = (rows) => { if (!rows.length) return ''; const cols = Object.keys(rows[0]); const esc = (v) => { const s = typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }; return [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n') + '\n'; };
writeFileSync(`${out}/audit50_evidence.json`, JSON.stringify(samples, null, 1));
writeFileSync(`${out}/audit50_evidence.csv`, csv(samples.map((s) => ({ ...s, tags: JSON.stringify(s.tags), lifecycle_tags: s.lifecycle_tags.join(' '), surroundings: s.surroundings.join(' | ') }))));
writeFileSync(`${out}/audit_unnamed_worship.csv`, csv(unnamedWorship));
writeFileSync(`${out}/audit_institutional.csv`, csv(institutionalFood));
console.log(JSON.stringify({ samples: samples.length, found: samples.filter((s) => s.found_in_current_data).length, outside_boundary: samples.filter((s) => !s.inside_boundary).map((s) => s.no), unnamed_worship: unnamedWorship.length, institutional: institutionalFood.length, context_polygons: ctx.length }));
