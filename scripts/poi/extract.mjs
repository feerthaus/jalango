// POI import step 1 (GitHub Actions): turn osmium exports into one record per
// OSM object, with the facts the import rules need. No network, no database.
//
//   node scripts/poi/extract.mjs poi.geojsonseq boundary.json places.geojsonseq coast.geojsonseq ctx.geojsonseq features.json
//
// poi.geojsonseq: osmium export --add-unique-id=type_id -a version,timestamp
// A closed way comes out twice (line w123 and area a246): both are the same
// object, way/123, and the area is kept (its centre). Areas a(2n+1) are relation/n.
import { readFileSync, writeFileSync } from 'node:fs';

const [, , poiFile, boundaryFile, placesFile, coastFile, ctxFile, outFile] = process.argv;
const lines = (f) => { try { return readFileSync(f, 'utf8').split('\n').map((l) => l.replace(/^\x1e/, '').trim()).filter(Boolean).map((l) => JSON.parse(l)); } catch { return []; } };

export function osmRef(id) {
  const m = String(id ?? '').match(/^([nwra])(\d+)$/);
  if (!m) return null;
  if (m[1] === 'n') return `node/${m[2]}`;
  if (m[1] === 'w') return `way/${m[2]}`;
  if (m[1] === 'r') return `relation/${m[2]}`;
  const a = BigInt(m[2]);
  return a % 2n === 0n ? `way/${a / 2n}` : `relation/${(a - 1n) / 2n}`;
}
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
const inRing = (pt, ring) => { let c = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, yi] = ring[i], [xj, yj] = ring[j]; if (yi > pt[1] !== yj > pt[1] && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) c = !c; } return c; };
const polysOf = (g) => (g.type === 'MultiPolygon' ? g.coordinates : [g.coordinates]);
const inPoly = (pt, g) => polysOf(g).some((p) => inRing(pt, p[0]) && !p.slice(1).some((h) => inRing(pt, h)));
const metres = (a, b) => Math.hypot((a[0] - b[0]) * 111320 * Math.cos((a[1] * Math.PI) / 180), (a[1] - b[1]) * 110574);
const segDist = (pt, a, b) => {
  const k = 111320 * Math.cos((pt[1] * Math.PI) / 180), q = 110574;
  const ax = (a[0] - pt[0]) * k, ay = (a[1] - pt[1]) * q, bx = (b[0] - pt[0]) * k, by = (b[1] - pt[1]) * q;
  const dx = bx - ax, dy = by - ay, len = dx * dx + dy * dy;
  const t = len ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len)) : 0;
  return Math.hypot(ax + t * dx, ay + t * dy);
};

export function extract({ poi, boundary, places, coast, ctx }) {
  // One record per OSM object; prefer the area export
  const byRef = new Map();
  for (const f of poi) {
    const ref = osmRef(f.id);
    if (!ref || !f.geometry) continue;
    const prev = byRef.get(ref);
    if (!prev || /Polygon/.test(f.geometry.type)) byRef.set(ref, f);
  }
  const settlements = places.filter((p) => p.geometry?.type === 'Point' && p.properties?.place)
    .map((p) => ({ tag: p.properties.place, name: p.properties.name ?? null, pt: p.geometry.coordinates }));
  const coastSegs = [];
  for (const c of coast) {
    const g = c.geometry; if (!g) continue;
    const parts = g.type === 'LineString' ? [g.coordinates] : g.type === 'MultiLineString' || g.type === 'Polygon' ? g.coordinates : g.type === 'MultiPolygon' ? g.coordinates.flat() : [];
    for (const line of parts) for (let i = 1; i < line.length; i++) coastSegs.push([line[i - 1], line[i]]);
  }
  const institutions = ctx.filter((c) => c.geometry && /Polygon/.test(c.geometry.type)).map((c) => {
    const t = c.properties ?? {};
    return { g: c.geometry, label: [t.name, t.amenity && `amenity=${t.amenity}`, t.landuse && `landuse=${t.landuse}`, t.office && `office=${t.office}`, t.military && `military=${t.military}`].filter(Boolean).join(' · ') };
  });
  const out = [];
  for (const [ref, f] of byRef) {
    const pt = centroid(f.geometry);
    if (!pt || !Number.isFinite(pt[0]) || !Number.isFinite(pt[1])) continue;
    const inside = inPoly(pt, boundary);
    if (!inside) continue; // only the pilot district is staged
    const tags = Object.fromEntries(Object.entries(f.properties ?? {}).filter(([k]) => !k.startsWith('@')));
    let near = null, nd = Infinity;
    for (const s of settlements) { const d = metres(pt, s.pt); if (d < nd) { nd = d; near = s; } }
    const inst = institutions.find((i) => inPoly(pt, i.g));
    const ts = f.properties?.['@timestamp'];
    out.push({
      osm_ref: ref,
      version: Number.isInteger(f.properties?.['@version']) ? f.properties['@version'] : null,
      last_edit: ts ? new Date(Number(ts) * 1000).toISOString() : null,
      tags,
      lat: pt[1],
      lng: pt[0],
      inside_boundary: true,
      inside_institution: inst ? inst.label.slice(0, 160) : null,
      place_tag: near && nd <= 3000 ? near.tag : null,
      nearest_place: near && nd <= 3000 ? near.name : null,
      coastal: coastSegs.some(([a, b]) => segDist(pt, a, b) <= 2000),
    });
  }
  return out;
}

if (outFile) {
  const features = extract({
    poi: lines(poiFile),
    boundary: JSON.parse(readFileSync(boundaryFile, 'utf8')),
    places: lines(placesFile),
    coast: lines(coastFile),
    ctx: lines(ctxFile),
  });
  writeFileSync(outFile, JSON.stringify(features));
  console.log(JSON.stringify({ features: features.length, in_institutions: features.filter((f) => f.inside_institution).length, coastal: features.filter((f) => f.coastal).length }));
}
