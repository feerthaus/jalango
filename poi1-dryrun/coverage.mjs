// Item 8: how POIs spread over towns, suburbs, villages and the coast.
// Each POI is tied to the nearest OSM settlement (place=*) within 3 km, and
// flagged "pantai" if within 2 km of the coastline. Also: share of villages
// with at least one POI within 1 km (a village with none is a coverage gap).
import { readFileSync, writeFileSync } from 'node:fs';
const [, , recordsFile, placesFile, coastFile, boundaryFile, out] = process.argv;
const lines = (f) => { try { return readFileSync(f, 'utf8').split('\n').map((l) => l.replace(/^\x1e/, '').trim()).filter(Boolean).map((l) => JSON.parse(l)); } catch { return []; } };
const recs = JSON.parse(readFileSync(recordsFile, 'utf8'));
const boundary = JSON.parse(readFileSync(boundaryFile, 'utf8'));
const polys = boundary.type === 'MultiPolygon' ? boundary.coordinates : [boundary.coordinates];
const inRing = (pt, ring) => { let c = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, yi] = ring[i], [xj, yj] = ring[j]; if (yi > pt[1] !== yj > pt[1] && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) c = !c; } return c; };
const inside = (pt) => polys.some((p) => inRing(pt, p[0]));
const m = (a, b) => Math.hypot((a[0] - b[0]) * 111320 * Math.cos((a[1] * Math.PI) / 180), (a[1] - b[1]) * 110574);
const GROUP = { city: 'bandar', town: 'bandar', suburb: 'pinggir bandar / taman', quarter: 'pinggir bandar / taman', neighbourhood: 'pinggir bandar / taman', village: 'kampung', hamlet: 'kampung', isolated_dwelling: 'kampung' };
const places = lines(placesFile).filter((f) => f.geometry?.type === 'Point' && GROUP[f.properties?.place] && inside(f.geometry.coordinates))
  .map((f) => ({ name: f.properties.name ?? '(tanpa nama)', place: f.properties.place, group: GROUP[f.properties.place], pt: f.geometry.coordinates }));
const coast = [];
for (const f of lines(coastFile)) { const w = (c) => (typeof c[0] === 'number' ? coast.push(c) : c.forEach(w)); if (f.geometry) w(f.geometry.coordinates); }
const near = (pt, list, max) => { let best = null, bd = Infinity; for (const p of list) { const d = m(pt, p.pt ?? p); if (d < bd) { bd = d; best = p; } } return bd <= max ? { item: best, d: bd } : null; };
const tally = {};
for (const r of recs) {
  const pt = [r.lng, r.lat];
  const p = near(pt, places, 3000);
  const zone = p ? p.item.group : 'luar petempatan (>3 km)';
  const pantai = coast.length && near(pt, coast, 2000) ? 'pantai (≤2 km)' : null;
  for (const z of [zone, pantai].filter(Boolean)) {
    tally[z] ??= { total: 0, auto_approved: 0, per_category: {} };
    tally[z].total++;
    if (r.decision === 'auto_approved') tally[z].auto_approved++;
    tally[z].per_category[r.category] = (tally[z].per_category[r.category] ?? 0) + 1;
  }
  r.zone = zone; r.coastal = Boolean(pantai); r.nearest_place = p ? `${p.item.name} (${p.item.place}, ${Math.round(p.d)} m)` : null;
}
const villages = places.filter((p) => p.group === 'kampung');
const villagesWithPoi = villages.filter((v) => recs.some((r) => m(v.pt, [r.lng, r.lat]) <= 1000));
const towns = places.filter((p) => p.group === 'bandar');
const result = {
  settlements_in_boundary: places.reduce((a, p) => ((a[p.place] = (a[p.place] ?? 0) + 1), a), {}),
  towns: towns.map((t) => ({ name: t.name, pois_within_2km: recs.filter((r) => m(t.pt, [r.lng, r.lat]) <= 2000).length })).sort((a, b) => b.pois_within_2km - a.pois_within_2km),
  villages_total: villages.length,
  villages_with_poi_within_1km: villagesWithPoi.length,
  villages_with_poi_pct: villages.length ? Math.round((1000 * villagesWithPoi.length) / villages.length) / 10 : null,
  villages_without_poi_examples: villages.filter((v) => !villagesWithPoi.includes(v)).slice(0, 25).map((v) => v.name),
  coastline_points: coast.length,
  by_zone: tally,
};
writeFileSync(`${out}/coverage.json`, JSON.stringify(result, null, 2));
writeFileSync(recordsFile, JSON.stringify(recs, null, 1));
console.log(JSON.stringify({ zones: Object.fromEntries(Object.entries(tally).map(([k, v]) => [k, v.total])), villages: `${villagesWithPoi.length}/${villages.length}` }));
