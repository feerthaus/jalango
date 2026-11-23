// Dry-run review report (read-only): prints what the import would do, for the owner's Go / No-Go review.
import { readFileSync } from 'node:fs';
const features = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const rows = JSON.parse(readFileSync(process.argv[3], 'utf8'));
const line = (r) => `${r.osm_ref} | ${r.name ?? '(tiada nama)'} | ${r.category}/${r.subcategory ?? '-'} | ${r.decision}${r.reject_reason ? ' (' + r.reject_reason + ')' : ''} | ${r.settlement_class ?? '-'} ${r.nearest_place ?? ''} | ${r.issues.join(',')}${r.inside_institution ? ' | dalam: ' + r.inside_institution : ''}`;
const sec = (t) => console.log(`\n=====${t}=====`);
sec('BY_CATEGORY');
const cats = [...new Set(rows.map((r) => r.category))].sort();
for (const c of cats) { const rs = rows.filter((r) => r.category === c); const n = (d) => rs.filter((r) => r.decision === d).length; console.log(`${c}: ${rs.length} | auto ${n('auto_approved')} | review ${n('needs_review')} | rejected ${n('rejected')} | duplicate ${n('duplicate')}`); }
sec('NOT_IN_8_CATEGORIES');
const inRows = new Set(rows.map((r) => r.osm_ref));
const skipped = features.filter((f) => !inRows.has(f.osm_ref));
const key = (t) => t.amenity ? `amenity=${t.amenity}${t.religion ? ' religion=' + t.religion : ''}` : t.leisure ? `leisure=${t.leisure}${t.name ? '' : ' (tanpa nama)'}` : t.historic ? `historic=${t.historic}${t.name ? '' : ' (tanpa nama)'}` : t.natural ? `natural=${t.natural}` : t.shop ? `shop=${t.shop}` : t.tourism ? `tourism=${t.tourism}` : t.healthcare ? `healthcare=${t.healthcare}` : 'lain';
const g = {}; for (const f of skipped) { const k = key(f.tags); g[k] = (g[k] ?? 0) + 1; }
console.log(skipped.length, JSON.stringify(g));
sec('SPOT_IKBN'); rows.filter((r) => /ikbn/i.test(r.name ?? '') || /ikbn/i.test(r.inside_institution ?? '')).forEach((r) => console.log(line(r)));
sec('SPOT_ECOWORLD'); rows.filter((r) => /ecoworld|eco world/i.test(r.name ?? '')).forEach((r) => console.log(line(r)));
sec('SPOT_ECO_SANCTUARY');
const eco = rows.filter((r) => /eco sanctuary/i.test(`${r.nearest_place} ${r.name}`));
const n = (d) => eco.filter((r) => r.decision === d).length;
console.log(`rekod berhampiran/bernama Eco Sanctuary: ${eco.length} | auto ${n('auto_approved')} | review ${n('needs_review')} | rejected ${n('rejected')} | duplicate ${n('duplicate')}`);
eco.slice(0, 40).forEach((r) => console.log(line(r)));
sec('SPOT_UNNAMED_WORSHIP'); const uw = rows.filter((r) => r.category === 'ibadah' && !r.name); console.log(`${uw.length} rekod`); uw.forEach((r) => console.log(line(r)));
sec('SPOT_OUTSIDE'); console.log(`features luar sempadan: ${features.filter((f) => !f.inside_boundary).length} | baris luar_kawasan: ${rows.filter((r) => r.reject_reason === 'luar_kawasan').length} | settlement luar: ${rows.filter((r) => r.settlement_class === 'luar').length}`);
const lat = rows.map((r) => r.lat), lng = rows.map((r) => r.lng); console.log(`kotak koordinat: lat ${Math.min(...lat)}–${Math.max(...lat)}, lng ${Math.min(...lng)}–${Math.max(...lng)}`);
sec('REJECTED_INSTITUTION'); rows.filter((r) => r.reject_reason === 'institusi').forEach((r) => console.log(line(r)));
sec('REJECTED_UNNAMED_OTHER'); rows.filter((r) => r.reject_reason === 'nama_kosong' && r.category !== 'ibadah').forEach((r) => console.log(line(r)));
sec('NEEDS_REVIEW'); rows.filter((r) => r.decision === 'needs_review').forEach((r) => console.log(line(r)));
sec('DUPLICATES'); rows.filter((r) => r.decision === 'duplicate').forEach((r) => console.log(line(r)));
sec('DEDUP_CHECK'); console.log(`osm_ref unik: ${new Set(rows.map((r) => r.osm_ref)).size} daripada ${rows.length} baris; way+area digabung oleh extract (satu osm_ref setiap objek)`);
sec('SETTLEMENT'); const s = {}; for (const r of rows) { const k = r.settlement_class ?? '(tiada petempatan 3 km)'; s[k] = (s[k] ?? 0) + 1; } console.log(JSON.stringify(s));
sec('END');
