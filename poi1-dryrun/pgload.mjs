// records.json → CSV for psql \copy into a throwaway "pois" table (size measurement only)
import { readFileSync, writeFileSync } from 'node:fs';
const recs = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const esc = (v) => (v == null ? '' : `"${String(v).replace(/"/g, '""')}"`);
const lines = recs.map((r) => [r.source_ref, r.version ?? '', r.category, r.subcategory, r.name, r.name_norm, r.lat, r.lng, r.address, r.phone, r.website, r.opening_hours, r.brand, r.quality, r.decision === 'auto_approved' ? 'active' : 'hidden'].map(esc).join(','));
writeFileSync(process.argv[3], lines.join('\n') + '\n');
console.log(`${recs.length} rows`);
