// POI import step 2 (GitHub Actions): apply the import rules (server/src/poi/rules.ts,
// tested in CI) and send the rows to the JalanGo API, which stages and processes
// them in Supabase. Run with Node 22+ (TypeScript types are stripped).
//
//   node scripts/poi/import.ts features.json out/source.json [--send]
//
// Without --send it is a dry run: it prints what would be sent and sends nothing.
// With --send it needs POI_INGEST_TOKEN and uses POI_API_BASE (default the live site).
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { buildStaging, type OsmFeature } from '../../server/src/poi/rules.ts';

const [, , featuresFile, sourceFile, flag] = process.argv;
const send = flag === '--send';
const features = JSON.parse(readFileSync(featuresFile, 'utf8')) as OsmFeature[];
const source = JSON.parse(readFileSync(sourceFile, 'utf8')) as { url: string; md5?: string; md5_verified?: boolean; osm_replication_timestamp?: string };

const rows = buildStaging(features);
const count = (d: string) => rows.filter((r) => r.decision === d).length;
const summary = {
  features: features.length,
  rows: rows.length,
  auto_approved: count('auto_approved'),
  needs_review: count('needs_review'),
  rejected: count('rejected'),
  duplicate: count('duplicate'),
  rejected_by_reason: Object.fromEntries([...new Set(rows.filter((r) => r.reject_reason).map((r) => r.reject_reason!))].map((k) => [k, rows.filter((r) => r.reject_reason === k).length])),
  stale: rows.filter((r) => r.issues.includes('data_lapuk')).length,
};
console.log(JSON.stringify(summary, null, 1));
writeFileSync('out/staging.json', JSON.stringify(rows));

if (!send) {
  console.log('Dry run: nothing sent. Run with --send to import.');
  process.exit(0);
}

const token = process.env.POI_INGEST_TOKEN?.trim();
const base = (process.env.POI_API_BASE?.trim() || 'https://jalango.netlify.app').replace(/\/+$/, '');
if (!token) throw new Error('POI_INGEST_TOKEN is not set');
if (!source.md5_verified) throw new Error('The extract MD5 was not verified: not importing it.');
const md5 = readFileSync('region.md5', 'utf8').split(/\s+/)[0];

async function call(path: string, body: unknown): Promise<any> {
  // Bounded: 3 tries, 20 s apart, 60 s each
  for (let i = 1; i <= 3; i++) {
    try {
      const r = await fetch(base + path, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(60_000),
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok) return j;
      // 4xx: our request is wrong, retrying won't help
      if (r.status < 500) throw new Error(`${path}: HTTP ${r.status} ${JSON.stringify(j)}`);
      console.log(`${path}: HTTP ${r.status}, try ${i}/3`);
    } catch (e) {
      if (e instanceof Error && e.message.startsWith(path)) throw e;
      console.log(`${path}: ${(e as Error).message}, try ${i}/3`);
    }
    if (i < 3) await new Promise((res) => setTimeout(res, 20_000));
  }
  throw new Error(`${path}: gave up after 3 tries`);
}

const { run } = await call('/api/poi/runs', {
  region: 'kuala-langat',
  extract_url: source.url,
  extract_md5: md5,
  extract_timestamp: source.osm_replication_timestamp,
});
console.log(`Run ${run}`);
let staged = 0;
for (let i = 0; i < rows.length; i += 200) {
  const { staged: n } = await call(`/api/poi/runs/${run}/rows`, { rows: rows.slice(i, i + 200) });
  staged += n;
}
console.log(`Staged ${staged} of ${rows.length}`);
const { result } = await call(`/api/poi/runs/${run}/process`, {});
console.log(JSON.stringify({ run, result }, null, 1));
writeFileSync('out/import-result.json', JSON.stringify({ run, staged, result, summary }, null, 2));

// Report for whoever opens the run (GitHub step summary), and fail on a held run
// so GitHub notifies the owner: a held run waits for an admin in Admin → POI.
const summaryFile = process.env.GITHUB_STEP_SUMMARY;
if (summaryFile) {
  const r = result as Record<string, unknown>;
  const lines = [
    `### POI import ${String(r.status)}`,
    '',
    '| | |',
    '|---|---|',
    ...['rows', 'auto_approved', 'needs_review', 'rejected', 'duplicate', 'carried', 'live_before', 'would_hide', 'would_change', 'absent_once'].map((k) => `| ${k} | ${r[k] ?? '–'} |`),
    '',
    `Run \`${run}\`, OSM data ${source.osm_replication_timestamp}.`,
  ];
  appendFileSync(summaryFile, lines.join('\n') + '\n');
}
if ((result as { status?: string }).status === 'held') {
  console.error('Run held: it would hide > 5 % or change > 20 % of live POIs. Review it in Admin → POI → Larian import.');
  process.exit(2);
}
