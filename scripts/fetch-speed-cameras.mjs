// Convert OpenStreetMap speed cameras (highway=speed_camera) exported by osmium as
// GeoJSON-seq into web/public/data/speed-cameras.json.
// Data © OpenStreetMap contributors, ODbL 1.0. Source extract: Geofabrik.
// Usage: node scripts/fetch-speed-cameras.mjs cameras.geojsonseq   (see .github/workflows/speed-cameras.yml)
import { readFileSync, writeFileSync } from 'node:fs';

const input = process.argv[2];
if (!input) {
  console.error('usage: node scripts/fetch-speed-cameras.mjs <cameras.geojsonseq>');
  process.exit(2);
}
const OUT = new URL('../web/public/data/speed-cameras.json', import.meta.url);

export function maxspeed(tag) {
  const m = typeof tag === 'string' ? tag.match(/^(\d{2,3})\s*(mph)?/) : null;
  if (!m) return null;
  return m[2] ? Math.round(Number(m[1]) * 1.609) : Number(m[1]);
}

const cameras = readFileSync(input, 'utf8')
  .split('\n')
  .map((line) => line.replace(/^\x1e/, '').trim())
  .filter(Boolean)
  .map((line) => JSON.parse(line))
  .filter((f) => f.geometry?.type === 'Point')
  .map((f, i) => ({
    id: `osm:${f.id ?? f.properties?.['@id'] ?? i}`,
    lat: Math.round(f.geometry.coordinates[1] * 1e6) / 1e6,
    lng: Math.round(f.geometry.coordinates[0] * 1e6) / 1e6,
    maxspeed: maxspeed(f.properties?.maxspeed),
  }))
  .sort((a, b) => a.lat - b.lat || a.lng - b.lng);

if (cameras.length < 10) {
  console.error(`Only ${cameras.length} cameras found — looks wrong; keeping the existing file.`);
  process.exit(1);
}
writeFileSync(OUT, `${JSON.stringify({ attribution: '© OpenStreetMap contributors (ODbL), extract by Geofabrik', source: 'highway=speed_camera', cameras })}\n`);
console.log(`Wrote ${cameras.length} cameras (${cameras.filter((c) => c.maxspeed).length} with a speed limit)`);
