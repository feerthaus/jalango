// Pick Kuala Langat (district, admin_level 6) and its mukim (admin_level 7/8)
// from an osmium geojsonseq export of administrative boundaries.
import { readFileSync, writeFileSync } from 'node:fs';
const [, , input, out] = process.argv;
const feats = readFileSync(input, 'utf8').split('\n').map((l) => l.replace(/^\x1e/, '').trim()).filter(Boolean).map((l) => JSON.parse(l))
  .filter((f) => f.geometry && (f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon'));
const polysOf = (g) => (g.type === 'MultiPolygon' ? g.coordinates : [g.coordinates]);
const district = feats.find((f) => String(f.properties?.admin_level) === '6' && /kuala\s*langat/i.test(f.properties?.name ?? ''));
const inRing = (pt, ring) => { let c = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, yi] = ring[i], [xj, yj] = ring[j]; if (yi > pt[1] !== yj > pt[1] && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) c = !c; } return c; };
const centre = (g) => { const p = []; const w = (c) => (typeof c[0] === 'number' ? p.push(c) : c.forEach(w)); w(g.coordinates); return p.reduce((a, q) => [a[0] + q[0] / p.length, a[1] + q[1] / p.length], [0, 0]); };
let boundary, how;
if (district) { boundary = district.geometry; how = `OSM ${district.id} "${district.properties.name}" admin_level=6`; }
else { boundary = { type: 'Polygon', coordinates: [[[101.33, 2.6], [101.72, 2.6], [101.72, 2.99], [101.33, 2.99], [101.33, 2.6]]] }; how = 'FALLBACK bbox 101.33–101.72, 2.60–2.99 (district polygon not found)'; }
const dpolys = polysOf(boundary);
const mukim = feats.filter((f) => ['7', '8'].includes(String(f.properties?.admin_level)) && f.properties?.name && dpolys.some((p) => inRing(centre(f.geometry), p[0])))
  .map((f) => ({ name: f.properties.name, admin_level: f.properties.admin_level, id: f.id, polys: polysOf(f.geometry) }));
writeFileSync(`${out}.json`, JSON.stringify(boundary));
writeFileSync(`${out}-mukim.json`, JSON.stringify(mukim));
console.log(JSON.stringify({ boundary: how, mukim: mukim.map((m) => `${m.name} (L${m.admin_level}, ${m.id})`) }, null, 1));
