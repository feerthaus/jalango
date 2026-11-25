import { AlertTriangle, Check, Eye, EyeOff, ExternalLink, GitMerge, Loader2, Pencil, RotateCcw, Search, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/cn';
import { poiAdminService } from '@/services/poiAdminService';
import { formatRelativeTime } from '@/utils/format';
import {
  CATEGORY_LABEL,
  ISSUE_LABEL,
  POI_CATEGORIES,
  qualityMetrics,
  reviewQueue,
  runCounts,
  type Decision,
  type Issue,
  type LivePoi,
  type PoiAdminState,
  type PoiCategory,
  type QueueFilter,
  type StagingRecord,
} from '@/utils/poiReview';
import { PoiMapPreview } from './PoiMapPreview';

type View = 'review' | 'live' | 'runs' | 'metrics' | 'audit';
const VIEWS: { id: View; label: string }[] = [
  { id: 'review', label: 'Semakan' },
  { id: 'live', label: 'POI live' },
  { id: 'runs', label: 'Larian import' },
  { id: 'metrics', label: 'Metrik kualiti' },
  { id: 'audit', label: 'Log audit' },
];

const DECISION_LABEL: Record<Decision, string> = {
  needs_review: 'Perlu semakan',
  duplicate: 'Mungkin pendua',
  auto_approved: 'Lulus automatik',
  approved: 'Diluluskan',
  rejected: 'Ditolak',
  merged: 'Digabung',
  rolled_back: 'Di-rollback',
};

const REJECT_REASONS = ['Bukan premis sebenar', 'Lokasi salah', 'Sudah tutup', 'Kategori tidak sesuai', 'Pendua', 'Lain-lain'];

/**
 * Admin → POI (POI-2A): review queue, import runs with rollback, quality
 * metrics and audit log. Runs on clearly labelled TEST data until POI-2B
 * (no database tables yet, nothing is saved).
 */
export function PoiPanel() {
  const [state, setState] = useState<PoiAdminState | null>(null);
  const [view, setView] = useState<View>('review');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    poiAdminService.load().then(setState).catch((e: Error) => setError(e.message));
  }, []);

  const act = useCallback(async (f: () => Promise<PoiAdminState>) => {
    setBusy(true);
    setError(null);
    try {
      setState(await f());
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal');
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  if (!state) return error ? <p role="alert" className="text-sm text-red-600">{error}</p> : <Loader2 className="mx-auto size-6 animate-spin text-ink-400" />;
  const open = reviewQueue(state).length;

  return (
    <div className="space-y-4">
      {poiAdminService.testData && (
        <div role="note" className="flex items-start gap-2 rounded-2xl bg-amber-400/15 p-3 text-sm text-amber-900 ring-1 ring-amber-500/40 dark:text-amber-100">
          <AlertTriangle className="mt-0.5 size-5 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="font-bold">DATA UJIAN</p>
            <p className="text-xs">
              Rekod rekaan (nama bermula "Contoh") untuk membina skrin dan aliran semakan ini. <strong>Bukan data OpenStreetMap sebenar</strong>, bukan premis sebenar, dan <strong>tiada apa disimpan</strong> ke pangkalan data: semua tindakan hilang bila halaman dimuat semula. Data sebenar selepas POI-1 (liputan OSM) dan POI-2B (jadual Supabase).
            </p>
          </div>
          <Button variant="secondary" className="shrink-0 px-2 py-1 text-xs" disabled={busy} onClick={() => act(() => poiAdminService.reset())}>
            Set semula
          </Button>
        </div>
      )}

      {!poiAdminService.testData && (
        <div role="note" className="rounded-2xl bg-ink-100 p-3 text-xs text-ink-600 dark:bg-ink-800 dark:text-ink-300">
          <p>
            <strong>Data sebenar</strong> daripada OpenStreetMap (© penyumbang OpenStreetMap, ODbL), pilot Kuala Langat. Setiap tindakan direkod dan setiap larian boleh di-rollback.
          </p>
          {state.runs.length === 0 && (
            <p className="mt-1">
              Belum ada import. Import dijalankan secara manual melalui GitHub Actions ("POI import (Kuala Langat)"), hanya dengan kebenaran pemilik.
            </p>
          )}
        </div>
      )}

      <div role="tablist" aria-label="Bahagian POI" className="flex gap-1 overflow-x-auto rounded-2xl bg-ink-100 p-1 text-sm font-semibold dark:bg-ink-800">
        {VIEWS.map((v) => (
          <button key={v.id} type="button" role="tab" aria-selected={view === v.id} onClick={() => setView(v.id)} className={cn('shrink-0 rounded-xl px-3 py-2', view === v.id ? 'bg-white shadow dark:bg-ink-900' : 'text-ink-500')}>
            {v.label}
            {v.id === 'review' && open > 0 && <span className="ml-1 rounded-full bg-red-600 px-1.5 text-[11px] text-white">{open}</span>}
          </button>
        ))}
      </div>

      {error && (
        <p role="alert" className="rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      )}

      {view === 'review' && <ReviewView state={state} busy={busy} act={act} />}
      {view === 'live' && <LiveView busy={busy} act={act} />}
      {view === 'runs' && <RunsView state={state} busy={busy} act={act} />}
      {view === 'metrics' && <MetricsView state={state} />}
      {view === 'audit' && <AuditView state={state} />}
    </div>
  );
}

type Act = (f: () => Promise<PoiAdminState>) => Promise<boolean>;

function ReviewView({ state, busy, act }: { state: PoiAdminState; busy: boolean; act: Act }) {
  const [filter, setFilter] = useState<QueueFilter>({ category: 'all', issue: 'all', decision: 'open' });
  const rows = useMemo(() => reviewQueue(state, filter), [state, filter]);
  const [selected, setSelected] = useState<string | null>(null);
  const current = rows.find((r) => r.id === selected) ?? null;
  const matchAt = (r: StagingRecord) => {
    const p = r.match ? state.pois.find((x) => x.id === r.match!.poiId) : undefined;
    return p ? { lat: p.lat, lng: p.lng } : null;
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <Select label="Kategori" value={filter.category ?? 'all'} onChange={(v) => setFilter((f) => ({ ...f, category: v as PoiCategory | 'all' }))} options={[['all', 'Semua kategori'], ...POI_CATEGORIES.map((c) => [c, CATEGORY_LABEL[c]] as [string, string])]} />
        <Select label="Isu" value={filter.issue ?? 'all'} onChange={(v) => setFilter((f) => ({ ...f, issue: v as Issue | 'all' }))} options={[['all', 'Semua isu'], ...(Object.keys(ISSUE_LABEL) as Issue[]).map((i) => [i, ISSUE_LABEL[i]] as [string, string])]} />
        <Select
          label="Status"
          value={filter.decision ?? 'open'}
          onChange={(v) => setFilter((f) => ({ ...f, decision: v as QueueFilter['decision'] }))}
          options={[['open', 'Menunggu semakan'], ...(['auto_approved', 'approved', 'rejected', 'merged', 'rolled_back'] as Decision[]).map((d) => [d, DECISION_LABEL[d]] as [string, string])]}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <ul className="space-y-2" aria-label="Rekod">
          {rows.length === 0 && <li className="rounded-2xl bg-white p-4 text-center text-sm text-ink-500 dark:bg-ink-900">Tiada rekod dalam penapis ini.</li>}
          {rows.map((r) => (
            <li key={r.id}>
              <button type="button" onClick={() => setSelected(r.id)} aria-pressed={selected === r.id} className={cn('w-full rounded-2xl bg-white p-3 text-left text-sm shadow-sm ring-1 dark:bg-ink-900', selected === r.id ? 'ring-2 ring-jade-500' : 'ring-ink-200 dark:ring-ink-800')}>
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{r.name ?? <em className="text-ink-400">(tiada nama)</em>}</p>
                    <p className="text-xs text-ink-500">
                      {CATEGORY_LABEL[r.category]} · {DECISION_LABEL[r.decision]}
                    </p>
                  </div>
                  <QualityBadge q={r.quality} />
                </div>
                {r.issues.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {r.issues.map((i) => (
                      <span key={i} className="rounded-full bg-amber-400/15 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:text-amber-200">
                        {ISSUE_LABEL[i]}
                      </span>
                    ))}
                  </div>
                )}
              </button>
              {/* On phones the detail opens under the record */}
              {current?.id === r.id && (
                <div className="mt-2 lg:hidden">
                  <RecordDetail key={r.id} r={r} matchAt={matchAt(r)} busy={busy} act={act} onDone={() => setSelected(null)} />
                </div>
              )}
            </li>
          ))}
        </ul>
        <div className="hidden lg:block">
          {current ? <RecordDetail key={current.id} r={current} matchAt={matchAt(current)} busy={busy} act={act} onDone={() => setSelected(null)} /> : <p className="rounded-2xl bg-white p-4 text-sm text-ink-500 dark:bg-ink-900">Pilih satu rekod untuk lihat butiran dan peta.</p>}
        </div>
      </div>
    </div>
  );
}

function RecordDetail({ r, matchAt, busy, act, onDone }: { r: StagingRecord; matchAt: { lat: number; lng: number } | null; busy: boolean; act: Act; onDone: () => void }) {
  const [category, setCategory] = useState<PoiCategory>(r.category);
  const [name, setName] = useState(r.name ?? '');
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState(REJECT_REASONS[0]);
  const [other, setOther] = useState('');
  const openable = r.decision === 'needs_review' || r.decision === 'duplicate';
  const osm = r.sourceRef.replace(/^osm:/, '');

  return (
    <section aria-label="Butiran rekod" className="space-y-3 rounded-2xl bg-white p-3 text-sm shadow-sm ring-1 ring-ink-200 dark:bg-ink-900 dark:ring-ink-800">
      <PoiMapPreview
        pins={[
          { lat: r.lat, lng: r.lng, color: '#e11d48', label: r.name ?? '(tiada nama)' },
          ...(r.match && matchAt ? [{ ...matchAt, color: '#2563eb', label: `POI sedia ada: ${r.match.name}` }] : []),
        ]}
      />
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
        <dt className="text-ink-500">Nama</dt>
        <dd className="font-semibold">{r.name ?? '—'}</dd>
        <dt className="text-ink-500">Koordinat</dt>
        <dd>
          <a className="inline-flex items-center gap-1 underline" href={`https://www.openstreetmap.org/?mlat=${r.lat}&mlon=${r.lng}#map=19/${r.lat}/${r.lng}`} target="_blank" rel="noopener noreferrer">
            {r.lat.toFixed(5)}, {r.lng.toFixed(5)} <ExternalLink className="size-3" />
          </a>
        </dd>
        <dt className="text-ink-500">Sumber</dt>
        <dd className="font-mono">{r.sourceRef} <span className="font-sans text-ink-400">({osm.startsWith('ujian') ? 'rekod ujian, tiada di OSM' : 'OSM'})</span></dd>
        <dt className="text-ink-500">Alamat</dt>
        <dd>{r.address ?? '—'}</dd>
        <dt className="text-ink-500">Telefon</dt>
        <dd>{r.phone ?? '—'}</dd>
        <dt className="text-ink-500">Kualiti</dt>
        <dd>{r.quality}/100</dd>
        {r.rejectReason && (
          <>
            <dt className="text-ink-500">Sebab tolak</dt>
            <dd>{r.rejectReason}</dd>
          </>
        )}
        {r.reviewedAt && (
          <>
            <dt className="text-ink-500">Disemak</dt>
            <dd>
              {r.reviewedBy} · {formatRelativeTime(r.reviewedAt, 'ms')}
            </dd>
          </>
        )}
      </dl>

      {r.match && (
        <p className="rounded-xl bg-sky-500/10 px-3 py-2 text-xs text-sky-900 dark:text-sky-100">
          🔵 Mungkin sama dengan POI sedia ada <strong>{r.match.name}</strong> ({r.match.metres} m).
        </p>
      )}

      {openable && (
        <div className="space-y-2 border-t border-ink-100 pt-3 dark:border-ink-800">
          <label className="block text-xs font-semibold text-ink-500">
            Nama bila diluluskan{r.issues.includes('nama_generik') && <span className="text-amber-600"> (nama generik: masukkan nama sebenar)</span>}
            <input value={name} onChange={(e) => setName(e.target.value.slice(0, 120))} className="mt-1 w-full rounded-xl bg-ink-100 px-3 py-2 text-sm font-normal text-ink-900 dark:bg-ink-800 dark:text-ink-50" />
          </label>
          <Select label="Kategori bila diluluskan" value={category} onChange={(v) => setCategory(v as PoiCategory)} options={POI_CATEGORIES.map((c) => [c, CATEGORY_LABEL[c]] as [string, string])} />
          <div className="flex flex-wrap gap-2">
            <Button className="px-3 py-1.5 text-xs" disabled={busy} onClick={async () => (await act(() => poiAdminService.approve(r.id, category, name))) && onDone()}>
              <Check className="size-3.5" /> Lulus
            </Button>
            {r.match && (
              <Button variant="secondary" className="px-3 py-1.5 text-xs" disabled={busy} onClick={async () => (await act(() => poiAdminService.merge(r.id, r.match!.poiId))) && onDone()}>
                <GitMerge className="size-3.5" /> Gabung dengan {r.match.name}
              </Button>
            )}
            <Button variant="danger" className="px-3 py-1.5 text-xs" disabled={busy} onClick={() => setRejecting((x) => !x)}>
              <X className="size-3.5" /> Tolak
            </Button>
          </div>
          {rejecting && (
            <div className="space-y-2 rounded-xl bg-red-500/5 p-2">
              <Select label="Sebab" value={reason} onChange={setReason} options={REJECT_REASONS.map((x) => [x, x] as [string, string])} />
              {reason === 'Lain-lain' && (
                <input value={other} onChange={(e) => setOther(e.target.value.slice(0, 120))} placeholder="Nyatakan sebab" aria-label="Sebab lain" className="w-full rounded-xl bg-ink-100 px-3 py-2 text-sm dark:bg-ink-800" />
              )}
              <Button variant="danger" className="px-3 py-1.5 text-xs" disabled={busy} onClick={async () => (await act(() => poiAdminService.reject(r.id, reason === 'Lain-lain' ? other : reason))) && onDone()}>
                Sahkan tolak
              </Button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function RunsView({ state, busy, act }: { state: PoiAdminState; busy: boolean; act: Act }) {
  const [confirming, setConfirming] = useState<string | null>(null);
  const runs = [...state.runs].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  return (
    <ul className="space-y-2">
      {runs.map((run) => {
        const c = runCounts(state, run.id);
        const changes = state.changes.filter((x) => x.runId === run.id).length;
        return (
          <li key={run.id} className="rounded-2xl bg-white p-3 text-sm shadow-sm ring-1 ring-ink-200 dark:bg-ink-900 dark:ring-ink-800">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-mono text-xs font-semibold">{run.id}</p>
              <RunStatusChip status={run.status} />
              <span className="ml-auto text-xs text-ink-500">{run.region} · {run.source}</span>
            </div>
            <p className="mt-1 text-xs text-ink-500">
              Ekstrak OSM {new Date(run.extractTimestamp).toLocaleString('ms-MY')} · dijalankan {new Date(run.startedAt).toLocaleString('ms-MY')}
            </p>
            {run.note && <p className="mt-1 rounded-lg bg-amber-400/15 px-2 py-1 text-xs text-amber-900 dark:text-amber-100">{run.note}</p>}
            <dl className="mt-2 grid grid-cols-3 gap-1 text-center text-xs sm:grid-cols-7">
              {(
                [
                  ['Diterima', c.received],
                  ['Lulus auto', c.autoApproved],
                  ['Diluluskan', c.approved],
                  ['Semakan', c.needsReview],
                  ['Pendua', c.duplicates],
                  ['Digabung', c.merged],
                  ['Ditolak', c.rejected],
                ] as [string, number][]
              ).map(([k, v]) => (
                <div key={k} className="rounded-lg bg-ink-50 px-1 py-1.5 dark:bg-ink-800">
                  <dt className="text-[10px] text-ink-500">{k}</dt>
                  <dd className="font-bold tabular-nums">{v}</dd>
                </div>
              ))}
            </dl>
            {run.status !== 'rolled_back' && (
              <div className="mt-2">
                {confirming === run.id ? (
                  <div className="flex flex-wrap items-center gap-2 rounded-xl bg-red-500/5 p-2 text-xs">
                    <span>Pasti? {changes} perubahan POI daripada larian ini akan dikembalikan, dan rekodnya ditutup.</span>
                    <Button variant="danger" className="px-3 py-1 text-xs" disabled={busy} onClick={async () => (await act(() => poiAdminService.rollback(run.id))) && setConfirming(null)}>
                      Ya, rollback
                    </Button>
                    <Button variant="secondary" className="px-3 py-1 text-xs" onClick={() => setConfirming(null)}>
                      Batal
                    </Button>
                  </div>
                ) : (
                  <Button variant="secondary" className="px-3 py-1.5 text-xs" disabled={busy} onClick={() => setConfirming(run.id)}>
                    <RotateCcw className="size-3.5" /> Rollback larian
                  </Button>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function MetricsView({ state }: { state: PoiAdminState }) {
  const m = qualityMetrics(state);
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Tile label="POI aktif" value={String(m.activePois)} />
        <Tile label="Menunggu semakan" value={String(m.backlog)} sub={m.oldestBacklogRun ? `tertua: ${new Date(m.oldestBacklogRun).toLocaleDateString('ms-MY')}` : undefined} />
        <Tile label="Lulus automatik" value={`${m.autoApprovePct}%`} />
        <Tile label="Ditolak" value={`${m.rejectPct}%`} sub={`pendua ${m.duplicatePct}%`} />
        <Tile label="Ada alamat" value={`${m.completeness.address}%`} sub="POI aktif" />
        <Tile label="Ada telefon" value={`${m.completeness.phone}%`} sub="POI aktif" />
      </div>
      <table className="w-full overflow-hidden rounded-2xl bg-white text-sm shadow-sm ring-1 ring-ink-200 dark:bg-ink-900 dark:ring-ink-800">
        <thead className="text-left text-xs text-ink-500">
          <tr>
            <th className="px-3 py-2">Kategori</th>
            <th className="px-3 py-2 text-right">Aktif</th>
            <th className="px-3 py-2 text-right">Menunggu</th>
          </tr>
        </thead>
        <tbody>
          {m.byCategory.map((c) => (
            <tr key={c.category} className="border-t border-ink-100 dark:border-ink-800">
              <td className="px-3 py-2">{CATEGORY_LABEL[c.category]}</td>
              <td className="px-3 py-2 text-right tabular-nums">{c.active}</td>
              <td className="px-3 py-2 text-right tabular-nums">{c.backlog}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs text-ink-500">Angka ini daripada data ujian. Ia menunjukkan bentuk paparan sahaja, bukan kualiti OSM sebenar.</p>
    </div>
  );
}

function AuditView({ state }: { state: PoiAdminState }) {
  const rows = [...state.audit].reverse();
  if (rows.length === 0) return <p className="rounded-2xl bg-white p-4 text-sm text-ink-500 dark:bg-ink-900">Belum ada tindakan. Lulus, tolak, gabung atau rollback akan direkod di sini (dalam POI-2B: dalam admin_actions).</p>;
  const ACTION: Record<string, string> = { approve: 'Lulus', reject: 'Tolak', merge: 'Gabung', rollback: 'Rollback', recategorise: 'Tukar kategori', rename: 'Tukar nama', hide: 'Sembunyi', show: 'Papar semula' };
  return (
    <ul className="divide-y divide-ink-100 rounded-2xl bg-white text-sm shadow-sm ring-1 ring-ink-200 dark:divide-ink-800 dark:bg-ink-900 dark:ring-ink-800">
      {rows.map((a, i) => (
        <li key={i} className="flex flex-wrap items-baseline gap-x-2 px-3 py-2">
          <span className="font-semibold">{ACTION[a.action] ?? a.action}</span>
          <span className="font-mono text-xs">{a.target}</span>
          <span className="min-w-0 flex-1 truncate text-ink-600 dark:text-ink-300">{a.note}</span>
          <span className="text-xs text-ink-400">
            {a.actor} · {formatRelativeTime(a.at, 'ms')}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Live POIs: find one, rename / change its category, hide it (e.g. a duplicate) or show it again. */
function LiveView({ busy, act }: { busy: boolean; act: Act }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<LivePoi[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const search = useCallback(async (text: string) => {
    if (text.trim().length < 2) return;
    setSearching(true);
    setErr(null);
    try {
      setResults(await poiAdminService.searchLive(text.trim()));
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Gagal');
    } finally {
      setSearching(false);
    }
  }, []);
  // After a change: refresh the screen state (act) and these results
  const change: Act = async (f) => {
    const done = await act(f);
    if (done) await search(q);
    return done;
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-ink-500">Cari POI yang sudah live untuk tukar nama atau kategori, atau sembunyikan (contoh: pendua). Import seterusnya mengekalkan keputusan admin. Setiap tindakan direkod.</p>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void search(q);
        }}
      >
        <input type="search" value={q} onChange={(e) => setQ(e.target.value.slice(0, 80))} placeholder="Nama atau node/123" aria-label="Cari POI live" className="min-w-0 flex-1 rounded-xl bg-white px-3 py-2 text-sm ring-1 ring-ink-200 dark:bg-ink-900 dark:ring-ink-800" />
        <Button type="submit" className="px-3 py-2" disabled={searching || q.trim().length < 2}>
          {searching ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />} Cari
        </Button>
      </form>
      {err && (
        <p role="alert" className="rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
          {err}
        </p>
      )}
      {results && results.length === 0 && <p className="rounded-2xl bg-white p-4 text-center text-sm text-ink-500 dark:bg-ink-900">Tiada POI sepadan.</p>}
      {results && results.length > 0 && (
        <ul className="space-y-2" aria-label="POI live">
          {results.map((p) => (
            <li key={p.id}>
              <button type="button" onClick={() => setSelected((x) => (x === p.id ? null : p.id))} aria-expanded={selected === p.id} className={cn('w-full rounded-2xl bg-white p-3 text-left text-sm shadow-sm ring-1 dark:bg-ink-900', selected === p.id ? 'ring-2 ring-jade-500' : 'ring-ink-200 dark:ring-ink-800')}>
                <p className="truncate font-semibold">{p.name}</p>
                <p className="text-xs text-ink-500">
                  {CATEGORY_LABEL[p.category]} · <span className="font-mono">{p.sourceRef}</span>
                  {p.liveStatus !== 'active' && <span className="ml-1 rounded-full bg-red-500/10 px-1.5 font-semibold text-red-700 dark:text-red-300">{p.liveStatus === 'missing' ? 'Tiada lagi di OSM' : 'Disembunyikan'}</span>}
                  {p.adminOverride && <span className="ml-1 rounded-full bg-sky-500/10 px-1.5 font-semibold text-sky-800 dark:text-sky-200">Disunting admin</span>}
                </p>
              </button>
              {selected === p.id && (
                <div className="mt-2">
                  <LivePoiDetail key={`${p.id}:${p.name}:${p.category}:${p.liveStatus}`} p={p} busy={busy} act={change} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function LivePoiDetail({ p, busy, act }: { p: LivePoi; busy: boolean; act: Act }) {
  const [name, setName] = useState(p.name);
  const [category, setCategory] = useState<PoiCategory>(p.category);
  const [hiding, setHiding] = useState(false);
  const [reason, setReason] = useState('Pendua');
  const [other, setOther] = useState('');
  const edited = name.replace(/\s+/g, ' ').trim() !== p.name || category !== p.category;
  const why = reason === 'Lain-lain' ? other.trim() : reason;

  return (
    <section aria-label="Butiran POI live" className="space-y-3 rounded-2xl bg-white p-3 text-sm shadow-sm ring-1 ring-ink-200 dark:bg-ink-900 dark:ring-ink-800">
      <PoiMapPreview pins={[{ lat: p.lat, lng: p.lng, color: '#e11d48', label: p.name }]} />
      <a className="inline-flex items-center gap-1 text-xs underline" href={`https://www.openstreetmap.org/?mlat=${p.lat}&mlon=${p.lng}#map=19/${p.lat}/${p.lng}`} target="_blank" rel="noopener noreferrer">
        {p.lat.toFixed(5)}, {p.lng.toFixed(5)} <ExternalLink className="size-3" />
      </a>
      <div className="space-y-2 border-t border-ink-100 pt-3 dark:border-ink-800">
        <label className="block text-xs font-semibold text-ink-500">
          Nama
          <input value={name} onChange={(e) => setName(e.target.value.slice(0, 120))} className="mt-1 w-full rounded-xl bg-ink-100 px-3 py-2 text-sm font-normal text-ink-900 dark:bg-ink-800 dark:text-ink-50" />
        </label>
        <Select label="Kategori" value={category} onChange={(v) => setCategory(v as PoiCategory)} options={POI_CATEGORIES.map((c) => [c, CATEGORY_LABEL[c]] as [string, string])} />
        <div className="flex flex-wrap gap-2">
          <Button className="px-3 py-1.5 text-xs" disabled={busy || !edited} onClick={() => act(() => poiAdminService.rename(p.id, name, category))}>
            <Pencil className="size-3.5" /> Simpan
          </Button>
          {p.liveStatus === 'active' ? (
            <Button variant="danger" className="px-3 py-1.5 text-xs" disabled={busy} onClick={() => setHiding((x) => !x)}>
              <EyeOff className="size-3.5" /> Sembunyi
            </Button>
          ) : p.liveStatus === 'hidden' ? (
            <Button variant="secondary" className="px-3 py-1.5 text-xs" disabled={busy} onClick={() => act(() => poiAdminService.setHidden(p.id, false))}>
              <Eye className="size-3.5" /> Papar semula
            </Button>
          ) : null}
        </div>
        {hiding && p.liveStatus === 'active' && (
          <div className="space-y-2 rounded-xl bg-red-500/5 p-2">
            <Select label="Sebab" value={reason} onChange={setReason} options={REJECT_REASONS.map((x) => [x, x] as [string, string])} />
            {reason === 'Lain-lain' && <input value={other} onChange={(e) => setOther(e.target.value.slice(0, 120))} placeholder="Nyatakan sebab" aria-label="Sebab lain" className="w-full rounded-xl bg-ink-100 px-3 py-2 text-sm dark:bg-ink-800" />}
            <Button variant="danger" className="px-3 py-1.5 text-xs" disabled={busy || !why} onClick={() => act(() => poiAdminService.setHidden(p.id, true, why))}>
              Sahkan sembunyi
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <label className="block text-xs font-semibold text-ink-500">
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full rounded-xl bg-ink-100 px-3 py-2 text-sm font-normal text-ink-900 dark:bg-ink-800 dark:text-ink-50">
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}

function QualityBadge({ q }: { q: number }) {
  return <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums', q >= 60 ? 'bg-jade-500/15 text-jade-700 dark:text-jade-300' : q >= 40 ? 'bg-amber-400/20 text-amber-800 dark:text-amber-200' : 'bg-red-500/15 text-red-700 dark:text-red-300')}>{q}</span>;
}

function RunStatusChip({ status }: { status: PoiAdminState['runs'][number]['status'] }) {
  const map = { running: ['Sedang berjalan', 'bg-sky-500/15 text-sky-700 dark:text-sky-300'], processed: ['Diproses', 'bg-jade-500/15 text-jade-700 dark:text-jade-300'], held: ['Ditahan', 'bg-amber-400/20 text-amber-800 dark:text-amber-200'], rolled_back: ['Di-rollback', 'bg-ink-200 text-ink-700 dark:bg-ink-700 dark:text-ink-200'], failed: ['Gagal', 'bg-red-500/15 text-red-700 dark:text-red-300'] } as const;
  const [label, tone] = map[status];
  return <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', tone)}>{label}</span>;
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-ink-200 dark:bg-ink-900 dark:ring-ink-800">
      <p className="text-xs text-ink-500">{label}</p>
      <p className="text-2xl font-black tabular-nums">{value}</p>
      {sub && <p className="text-[11px] text-ink-400">{sub}</p>}
    </div>
  );
}
