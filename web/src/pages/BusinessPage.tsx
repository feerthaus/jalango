import { Car, CheckCircle2, FileText, Home, Loader2, Trash2, Upload } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AuthForm } from '@/components/auth/AuthForm';
import { Button } from '@/components/ui/Button';
import { PagePanel } from '@/components/ui/PagePanel';
import { MyListings } from '@/components/business/MyListings';
import { useAuth } from '@/contexts/AuthContext';
import { normalizePhone } from '@/lib/driverProfile';
import { cn } from '@/lib/cn';
import { DOC_LABEL, KIND_LABEL, MY_STATES, STATUS_LABEL } from '@/lib/operatorLabels';
import {
  deleteOperatorDoc,
  docUrls,
  fetchMyOperator,
  requiredDocs,
  saveOperator,
  uploadOperatorDoc,
  type DocKind,
  type Operator,
  type OperatorDocument,
  type OperatorInput,
  type OperatorKind,
} from '@/services/operatorService';

const EMPTY: OperatorInput = { kind: 'homestay', business_name: '', state: '', town: '', phone: '', description: '', ssm_no: '', apad_licence_no: '', apad_expires_on: '', insurance_expires_on: '', licence_disclaimer_at: null };
const fmtDate = (iso: string | null) => (iso ? new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString('ms-MY', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '');

/** Marketplace phase 0: register a business (homestay or licensed car rental) for review. */
export function BusinessPage() {
  const { user, loading } = useAuth();
  const [operator, setOperator] = useState<Operator | null>(null);
  const [docs, setDocs] = useState<OperatorDocument[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!user) return;
    fetchMyOperator(user.id)
      .then((r) => {
        setOperator(r.operator);
        setDocs(r.docs);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoaded(true));
  }, [user]);
  useEffect(load, [load]);

  return (
    <PagePanel title="Bisnes saya" subtitle="Senaraikan homestay atau kereta sewa anda di JalanGo">
      {loading || (user && !loaded) ? (
        <Loader2 className="mx-auto mt-6 size-6 animate-spin text-ink-400" />
      ) : !user ? (
        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-ink-200 dark:bg-ink-900 dark:ring-ink-800">
          <p className="mb-3 text-sm text-ink-600 dark:text-ink-300">Log masuk untuk daftar bisnes anda.</p>
          <AuthForm compact />
        </div>
      ) : (
        <div className="space-y-3">
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
          {operator ? <StatusCard operator={operator} docs={docs} /> : <Intro />}
          {operator?.status === 'approved' && <MyListings operator={operator} />}
          <DetailsForm userId={user.id} operator={operator} onSaved={(o) => setOperator(o)} />
          {operator && <Documents userId={user.id} operator={operator} docs={docs} onChange={setDocs} />}
        </div>
      )}
    </PagePanel>
  );
}

function Intro() {
  return (
    <div className="rounded-2xl bg-gradient-to-br from-jade-500/15 to-sky-500/10 p-4 text-sm ring-1 ring-jade-500/30">
      <p className="font-bold">Promosikan bisnes anda kepada pemandu JalanGo</p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-ink-700 dark:text-ink-200">
        <li><strong>Percuma 6 bulan pertama</strong> selepas diluluskan.</li>
        <li>Pelanggan hubungi anda terus melalui WhatsApp. JalanGo tidak mengambil komisen.</li>
        <li>Semua operator disemak dahulu supaya pengguna percaya.</li>
        <li><strong>Homestay:</strong> IC pemilik + bukti pemilikan atau kebenaran.</li>
        <li><strong>Kereta sewa:</strong> SSM. Lesen APAD dan insurans digalakkan: operator berlesen mendapat lencana <strong>Berlesen APAD</strong>.</li>
      </ul>
    </div>
  );
}

function StatusCard({ operator, docs }: { operator: Operator; docs: OperatorDocument[] }) {
  const s = STATUS_LABEL[operator.status];
  const missing = requiredDocs(operator).filter((k) => !docs.some((d) => d.kind === k));
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-ink-200 dark:bg-ink-900 dark:ring-ink-800">
      <div className="flex items-center gap-2">
        <p className="min-w-0 flex-1 truncate font-bold">{operator.business_name}</p>
        <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold', s.tone)}>{s.text}</span>
      </div>
      <p className="text-xs text-ink-500">{KIND_LABEL[operator.kind]} · {operator.town}, {operator.state}</p>
      {operator.review_note && operator.status !== 'approved' && operator.status !== 'pending' && (
        <p className="mt-2 rounded-xl bg-ink-100 p-2 text-sm dark:bg-ink-800">
          <strong>Nota daripada JalanGo:</strong> {operator.review_note}
        </p>
      )}
      {operator.status === 'pending' && (
        <p className="mt-2 text-sm text-ink-600 dark:text-ink-300">
          {missing.length ? `Muat naik dokumen yang belum ada (${missing.length}) supaya kami boleh semak.` : 'Terima kasih. Kami akan semak dalam masa terdekat.'}
        </p>
      )}
      {operator.status === 'approved' && (
        <p className="mt-2 flex items-start gap-1.5 text-sm text-jade-700 dark:text-jade-300">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" /> Bisnes anda disahkan.{operator.free_until && ` Percuma sehingga ${fmtDate(operator.free_until)}.`}
        </p>
      )}
    </div>
  );
}

function DetailsForm({ userId, operator, onSaved }: { userId: string; operator: Operator | null; onSaved: (o: Operator) => void }) {
  const [f, setF] = useState<OperatorInput>(() => (operator ? toInput(operator) : EMPTY));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [agreed, setAgreed] = useState(Boolean(operator?.licence_disclaimer_at));
  const locked = operator?.status === 'suspended';
  const car = f.kind === 'car_rental';
  const set = <K extends keyof OperatorInput>(k: K, v: OperatorInput[K]) => {
    setF((x) => ({ ...x, [k]: v }));
    setSaved(false);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const phone = normalizePhone(f.phone);
    if (!phone || !phone.startsWith('60')) return setError('Masukkan nombor telefon/WhatsApp Malaysia, cth. 012-345 6789.');
    const licensed = car && Boolean(f.apad_licence_no?.trim());
    const insured = car && Boolean(f.insurance_expires_on);
    if (car && !f.ssm_no) return setError('Kereta sewa perlu No. SSM.');
    if (licensed && !f.apad_expires_on) return setError('Masukkan tarikh tamat lesen APAD.');
    if (car && (!licensed || !insured) && !agreed) return setError('Sila baca dan tandakan penafian.');
    setBusy(true);
    try {
      const clean: OperatorInput = {
        ...f,
        phone,
        description: f.description?.trim() || null,
        ssm_no: f.ssm_no?.trim() || null,
        apad_licence_no: car ? f.apad_licence_no?.trim() || null : null,
        apad_expires_on: licensed ? f.apad_expires_on || null : null,
        insurance_expires_on: car ? f.insurance_expires_on || null : null,
        // the server records the time; we only say it was accepted
        licence_disclaimer_at: car && (!licensed || !insured) ? new Date().toISOString() : null,
      };
      onSaved(await saveOperator(userId, clean, operator?.id));
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tidak dapat simpan.');
    } finally {
      setBusy(false);
    }
  };

  const input = 'mt-1 w-full rounded-xl bg-ink-100 px-3 py-2.5 text-base font-normal outline-none ring-jade-500 focus:ring-2 disabled:opacity-60 dark:bg-ink-800';
  return (
    <form onSubmit={submit} className="space-y-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-ink-200 dark:bg-ink-900 dark:ring-ink-800">
      <p className="font-bold">{operator ? 'Maklumat bisnes' : '1. Maklumat bisnes'}</p>
      <fieldset disabled={locked || busy} className="space-y-3">
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Jenis bisnes">
          {(['homestay', 'car_rental'] as OperatorKind[]).map((k) => (
            <button key={k} type="button" role="radio" aria-checked={f.kind === k} onClick={() => set('kind', k)} disabled={Boolean(operator)} className={cn('flex flex-col items-center gap-1 rounded-xl p-3 text-sm font-semibold ring-2 disabled:cursor-not-allowed', f.kind === k ? 'bg-jade-500/10 ring-jade-500' : 'ring-ink-200 dark:ring-ink-700', operator && f.kind !== k && 'opacity-40')}>
              {k === 'homestay' ? <Home className="size-6" /> : <Car className="size-6" />}
              {k === 'homestay' ? 'Homestay' : 'Kereta sewa'}
            </button>
          ))}
        </div>
        <label className="block text-sm font-semibold">Nama bisnes<input className={input} value={f.business_name} maxLength={80} required onChange={(e) => set('business_name', e.target.value)} placeholder={car ? 'cth. Kereta Sewa Maju Sdn Bhd' : 'cth. Homestay Pak Mat Pantai Cahaya Bulan'} /></label>
        <div className="grid grid-cols-2 gap-2">
          <label className="block text-sm font-semibold">Negeri
            <select className={input} value={f.state} required onChange={(e) => set('state', e.target.value)}>
              <option value="">Pilih…</option>
              {MY_STATES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </label>
          <label className="block text-sm font-semibold">Bandar / kawasan<input className={input} value={f.town} maxLength={60} required onChange={(e) => set('town', e.target.value)} placeholder="cth. Kota Bharu" /></label>
        </div>
        <label className="block text-sm font-semibold">No. telefon / WhatsApp<input className={input} type="tel" inputMode="tel" value={f.phone} required onChange={(e) => set('phone', e.target.value)} placeholder="012-345 6789" /></label>
        <label className="block text-sm font-semibold">No. SSM {car ? '' : '(jika ada)'}<input className={input} value={f.ssm_no ?? ''} maxLength={30} required={car} onChange={(e) => set('ssm_no', e.target.value)} /></label>
        {car && (
          <>
            <label className="block text-sm font-semibold">Insurans kenderaan tamat (jika ada)<span className="block text-xs font-normal text-ink-500">Jika banyak kereta, isi tarikh yang paling awal tamat.</span><input className={input} type="date" value={f.insurance_expires_on ?? ''} onChange={(e) => set('insurance_expires_on', e.target.value)} /></label>
            <label className="block text-sm font-semibold">No. lesen APAD (jika ada)<input className={input} value={f.apad_licence_no ?? ''} maxLength={40} onChange={(e) => set('apad_licence_no', e.target.value)} /></label>
            {f.apad_licence_no?.trim() && (
              <label className="block text-sm font-semibold">Lesen APAD tamat<input className={input} type="date" value={f.apad_expires_on ?? ''} required onChange={(e) => set('apad_expires_on', e.target.value)} /></label>
            )}
            {(!f.apad_licence_no?.trim() || !f.insurance_expires_on) && (
              <div className="rounded-xl bg-amber-400/15 p-3 text-xs leading-relaxed text-amber-900 dark:text-amber-100">
                <p className="font-bold">Penafian: {!f.apad_licence_no?.trim() && !f.insurance_expires_on ? 'tanpa lesen APAD dan insurans' : !f.apad_licence_no?.trim() ? 'tanpa lesen APAD' : 'tanpa maklumat insurans'}</p>
                <p className="mt-1">
                  Lesen APAD dan maklumat insurans tidak diwajibkan di JalanGo buat masa ini. Namun undang-undang Malaysia mungkin mewajibkan lesen untuk menyewakan kereta, dan insurans kereta persendirian biasanya tidak melindungi kegunaan sewa. Anda bertanggungjawab sepenuhnya untuk mematuhi undang-undang, insurans dan semua tuntutan berkaitan sewaan, termasuk kemalangan dan tuntutan pihak ketiga. JalanGo hanya menyenaraikan bisnes anda, tidak mengesahkan pematuhan anda, dan boleh mengubah syarat ini atau menggantung penyenaraian pada bila-bila masa. Pelanggan akan dimaklumkan jika anda tiada lesen APAD atau maklumat insurans.
                </p>
                <label className="mt-2 flex items-start gap-2 font-semibold">
                  <input type="checkbox" checked={agreed} onChange={(e) => { setAgreed(e.target.checked); setError(null); }} className="mt-0.5 size-4 accent-amber-600" />
                  Saya faham dan bersetuju dengan penafian ini.
                </label>
              </div>
            )}
          </>
        )}
        <label className="block text-sm font-semibold">Penerangan ringkas (pilihan)<textarea className={cn(input, 'resize-none')} rows={3} maxLength={500} value={f.description ?? ''} onChange={(e) => set('description', e.target.value)} /></label>
      </fieldset>
      {operator && !locked && <p className="text-xs text-ink-500">Menyimpan perubahan akan menghantar bisnes anda untuk disemak semula.</p>}
      {locked && <p className="text-sm text-red-600">Bisnes ini digantung. Hubungi JalanGo melalui Profil → Maklum balas.</p>}
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {!locked && (
        <Button type="submit" className="w-full py-3" disabled={busy}>
          {busy && <Loader2 className="size-4 animate-spin" />} {saved ? <><CheckCircle2 className="size-4" /> Disimpan</> : operator ? 'Simpan & hantar untuk semakan' : 'Daftar & teruskan ke dokumen'}
        </Button>
      )}
    </form>
  );
}

function Documents({ userId, operator, docs, onChange }: { userId: string; operator: Operator; docs: OperatorDocument[]; onChange: (d: OperatorDocument[]) => void }) {
  const [busy, setBusy] = useState<DocKind | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const kinds = useMemo<DocKind[]>(() => [...requiredDocs(operator), 'other'], [operator]);
  const locked = operator.status === 'suspended';

  const pathsKey = docs.map((d) => d.path).join('|');
  useEffect(() => {
    if (pathsKey) void docUrls(pathsKey.split('|')).then(setUrls);
  }, [pathsKey]);

  const upload = async (kind: DocKind, file: File | undefined) => {
    if (!file) return;
    setBusy(kind);
    setError(null);
    try {
      const d = await uploadOperatorDoc(userId, operator.id, kind, file);
      onChange([...docs, d]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Muat naik gagal.');
    } finally {
      setBusy(null);
    }
  };
  const remove = async (d: OperatorDocument) => {
    try {
      await deleteOperatorDoc(d);
      onChange(docs.filter((x) => x.id !== d.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Tidak dapat padam.');
    }
  };

  return (
    <div className="space-y-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-ink-200 dark:bg-ink-900 dark:ring-ink-800">
      <p className="font-bold">2. Dokumen pengesahan</p>
      <p className="text-xs text-ink-500">Gambar atau PDF. Dokumen hanya boleh dilihat oleh anda dan admin JalanGo, dan hanya digunakan untuk pengesahan.</p>
      <ul className="space-y-2">
        {kinds.map((k) => {
          const mine = docs.filter((d) => d.kind === k);
          const required = k !== 'other';
          return (
            <li key={k} className="rounded-xl bg-ink-100 p-3 dark:bg-ink-800">
              <div className="flex items-start gap-2">
                <span className="min-w-0 flex-1 text-sm font-semibold">
                  {mine.length ? <CheckCircle2 className="mr-1 inline size-4 text-jade-500" /> : required && <span className="mr-1 text-red-500">•</span>}
                  {DOC_LABEL[k]}
                </span>
                {!locked && (
                  <label className={cn('flex shrink-0 cursor-pointer items-center gap-1 rounded-lg bg-white px-2.5 py-1.5 text-xs font-semibold dark:bg-ink-700', busy && 'pointer-events-none opacity-60')}>
                    {busy === k ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />} Muat naik
                    <input type="file" accept="image/*,application/pdf" className="sr-only" aria-label={`Muat naik ${DOC_LABEL[k]}`} onChange={(e) => void upload(k, e.target.files?.[0])} />
                  </label>
                )}
              </div>
              {mine.map((d) => (
                <div key={d.id} className="mt-2 flex items-center gap-2 text-xs">
                  <FileText className="size-4 shrink-0 text-ink-400" />
                  {urls[d.path] ? <a href={urls[d.path]} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-sky-600">Lihat ({d.path.endsWith('.pdf') ? 'PDF' : 'gambar'})</a> : <span className="flex-1 text-ink-500">Dimuat naik</span>}
                  {!locked && (
                    <button type="button" onClick={() => void remove(d)} aria-label="Padam dokumen" className="grid size-7 place-items-center rounded-lg text-ink-400 hover:text-red-600">
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </li>
          );
        })}
      </ul>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

function toInput(o: Operator): OperatorInput {
  return {
    kind: o.kind,
    business_name: o.business_name,
    state: o.state,
    town: o.town,
    phone: o.phone.replace(/^60/, '0'),
    description: o.description ?? '',
    ssm_no: o.ssm_no ?? '',
    apad_licence_no: o.apad_licence_no ?? '',
    apad_expires_on: o.apad_expires_on ?? '',
    insurance_expires_on: o.insurance_expires_on ?? '',
    licence_disclaimer_at: o.licence_disclaimer_at,
  };
}
