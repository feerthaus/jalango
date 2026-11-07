// Fetch fixed speed cameras (AES / AWAS) in Malaysia from OpenStreetMap and write
// web/public/data/speed-cameras.json. Data © OpenStreetMap contributors, ODbL 1.0.
// Run by .github/workflows/speed-cameras.yml (weekly); `node scripts/fetch-speed-cameras.mjs` locally.
import { writeFileSync } from 'node:fs';

const QUERY = `[out:json][timeout:180];
area["ISO3166-1"="MY"][admin_level=2]->.my;
(node["highway"="speed_camera"](area.my););
out body;`;
const ENDPOINTS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://overpass.private.coffee/api/interpreter'];
const OUT = new URL('../web/public/data/speed-cameras.json', import.meta.url);

function maxspeed(tag) {
  const m = tag?.match(/^(\d{2,3})\s*(mph)?/);
  if (!m) return null;
  return m[2] ? Math.round(Number(m[1]) * 1.609) : Number(m[1]);
}

let elements = null;
for (const url of ENDPOINTS) {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'JalanGo speed-camera export (+https://jalango.netlify.app)' },
      body: `data=${encodeURIComponent(QUERY)}`,
      signal: AbortSignal.timeout(200_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    elements = (await res.json()).elements ?? [];
    console.log(`${url}: ${elements.length} cameras`);
    break;
  } catch (err) {
    console.warn(`${url} failed: ${err.message}`);
  }
}
if (!elements) {
  console.error('All Overpass endpoints failed; keeping the existing file.');
  process.exit(1);
}
if (elements.length < 10) {
  console.error(`Only ${elements.length} cameras returned — looks wrong; keeping the existing file.`);
  process.exit(1);
}

const cameras = elements
  .filter((e) => e.type === 'node')
  .map((e) => ({ id: `osm:${e.id}`, lat: Math.round(e.lat * 1e6) / 1e6, lng: Math.round(e.lon * 1e6) / 1e6, maxspeed: maxspeed(e.tags?.maxspeed) }))
  .sort((a, b) => a.id.localeCompare(b.id));

writeFileSync(OUT, `${JSON.stringify({ attribution: '© OpenStreetMap contributors (ODbL)', source: 'highway=speed_camera', cameras })}\n`);
console.log(`Wrote ${cameras.length} cameras to ${OUT.pathname}`);
