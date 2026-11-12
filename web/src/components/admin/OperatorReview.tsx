import { Ban, Check, FileText, HelpCircle, Loader2, RefreshCw, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { cn } from '@/lib/cn';
import { DOC_LABEL, KIND_LABEL, STATUS_LABEL } from '@/lib/operatorLabels';
import { docUrls, fetchOperatorsForReview, REQUIRED_DOCS, reviewOperator, type OperatorStatus, type OperatorWithDocs } from '@/services/operatorService';

const ORDER: OperatorStatus[] = ['pending', 'needs_info', 'approved', 'suspended', 'rejected'];
const fmt = (iso: string | null) => (iso ? new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString('ms-MY', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '–');

/** Admin: verify marketplace operators (documents, licence dates) and decide. */
export function OperatorReview() {
  const [items, setItems] = useState<OperatorWithDocs[] | null>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<'todo' | 'all'>('todo');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    fetchOperatorsForReview()
      .then(async (list) => {
        setItems(list);
        setUrls(await docUrls(list.flatMap((o) => o.documents.map((d) => d.path))));
      })
      .catch((e: Error) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  const shown = useMemo(
    () => (items ?? []).filter((o) => filter === 'all' || o.status === 'pending').sort((a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status)),
    [items, filter],
  );

  if (error) return <p role="alert" className="text-sm text-red-600">{error}</p>;
  if (!items) return <Loader2 className="mx-auto size-6 animate-spin text-ink-400" />;
  return (
    <>
      <div className="mb-3 flex items-center gap-2">
        {(['todo', 'all'] as const).map((f) => (
          <button key={f} type="button" onClick={() => setFilter(f)} aria-pressed={filter === f} className={cn('rounded-full px-3 py-1 text-xs font-semibold', filter === f ? 'bg-ink-900 text-white dark:bg-white dark:text-ink-900' : 'bg-ink-100 dark:bg-ink-800')}>
            {f === 'todo' ? `Perlu semakan (${items.filter((o) => o.status === 'pending').length})` : `Semua (${items.length})`}
          </button>
        ))}
        <Button variant="ghost" className="ml-auto px-2 py-1 text-xs" onClick={load}>
          <RefreshCw className="size-3.5" /> Muat semula
        </Button>
      </div>
      {shown.length === 0 ? (
        <EmptyState icon={Check} title="Tiada operator untuk disemak">Operator baru yang mendaftar akan muncul di sini.</EmptyState>
      ) : (
        <ul className="space-y-3">
          {shown.map((o) => <OperatorCard key={o.id} o={o} urls={urls} onDone={load} />)}
        </ul>
      )}
    </>
  );
}

function OperatorCard({ o, urls, onDone }: { o: OperatorWithDocs; urls: Record<string, string>; onDone: () => void }) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const missing = REQUIRED_DOCS[o.kind].filter((k) => !o.documents.some((d) => d.kind === k));
  const today = new Date().toISOString().slice(0, 10);
  const expired = o.kind === 'car_rental' && ((o.apad_expires_on ?? '') <= today || (o.insurance_expires_on ?? '') <= today);
  const s = STATUS_LABEL[o.status];

  const decide = async (d: 'approved' | 'needs_info' | 'rejected' | 'suspended') => {
    if (d !== 'approved' && !note.trim()) return setError('Tulis sebab/nota untuk operator dahulu.');
    setBusy(true);
    setError(null);
    try {
      await reviewOperator(o.id, d, note.trim() || undefined);
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-ink-200 dark:bg-ink-900 dark:ring-ink-800">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-bold">{o.business_name}</p>
          <p className="text-xs text-ink-500">{KIND_LABEL[o.kind]} · {o.town}, {o.state}</p>
        </div>
        <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold', s.tone)}>{s.text}</span>
      </div>
      <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
        <dt className="text-ink-500">Telefon</dt>
        <dd><a className="text-sky-600" href={`https://wa.me/${o.phone.replace(/^\+/, '')}`} target="_blank" rel="noreferrer">+{o.phone.replace(/^\+/, '')}</a></dd>
        <dt className="text-ink-500">SSM</dt>
        <dd>{o.ssm_no ?? '–'}</dd>
        {o.kind === 'car_rental' && (
          <>
            <dt className="text-ink-500">Lesen APAD</dt>
            <dd>{o.apad_licence_no} · tamat {fmt(o.apad_expires_on)}</dd>
            <dt className="text-ink-500">Insurans tamat</dt>
            <dd>{fmt(o.insurance_expires_on)}</dd>
          </>
        )}
        <dt className="text-ink-500">Didaftar / dikemas kini</dt>
        <dd>{fmt(o.created_at)} / {fmt(o.updated_at)}</dd>
        {o.free_until && (
          <>
            <dt className="text-ink-500">Percuma sehingga</dt>
            <dd>{fmt(o.free_until)}</dd>
          </>
        )}
      </dl>
      {o.description && <p className="mt-2 text-xs italic text-ink-600 dark:text-ink-300">“{o.description}”</p>}
      {expired && <p className="mt-2 text-xs font-semibold text-red-600">⚠ Lesen APAD atau insurans sudah tamat.</p>}
      {missing.length > 0 && <p className="mt-2 text-xs font-semibold text-amber-600">Dokumen belum ada: {missing.map((k) => DOC_LABEL[k]).join('; ')}</p>}
      <ul className="mt-2 space-y-1">
        {o.documents.map((d) => (
          <li key={d.id} className="flex items-center gap-1.5 text-xs">
            <FileText className="size-3.5 shrink-0 text-ink-400" />
            {urls[d.path] ? <a href={urls[d.path]} target="_blank" rel="noreferrer" className="text-sky-600 underline">{DOC_LABEL[d.kind]}</a> : DOC_LABEL[d.kind]}
          </li>
        ))}
      </ul>
      {o.review_note && <p className="mt-2 rounded-lg bg-ink-100 p-2 text-xs dark:bg-ink-800">Nota terakhir: {o.review_note}</p>}
      <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={2} placeholder="Nota untuk operator (wajib untuk Minta maklumat / Tolak / Gantung)" aria-label="Nota untuk operator" className="mt-3 w-full resize-none rounded-xl bg-ink-100 px-3 py-2 text-sm dark:bg-ink-800" />
      {error && <p role="alert" className="mt-1 text-xs text-red-600">{error}</p>}
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Button className="px-2 text-xs" disabled={busy || o.status === 'approved' || missing.length > 0 || expired} onClick={() => void decide('approved')}>
          <Check className="size-4" /> Lulus
        </Button>
        <Button variant="secondary" className="px-2 text-xs" disabled={busy} onClick={() => void decide('needs_info')}>
          <HelpCircle className="size-4" /> Minta maklumat
        </Button>
        <Button variant="danger" className="px-2 text-xs" disabled={busy || o.status === 'rejected'} onClick={() => void decide('rejected')}>
          <X className="size-4" /> Tolak
        </Button>
        <Button variant="danger" className="px-2 text-xs" disabled={busy || o.status === 'suspended'} onClick={() => void decide('suspended')}>
          <Ban className="size-4" /> Gantung
        </Button>
      </div>
    </li>
  );
}
