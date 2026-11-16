import { Car, CheckCircle2, FileText, Home, Loader2, Trash2, Upload, Utensils } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AuthForm } from '@/components/auth/AuthForm';
import { Button } from '@/components/ui/Button';
import { PagePanel } from '@/components/ui/PagePanel';
import { MyListings } from '@/components/business/MyListings';
import { useAuth } from '@/contexts/AuthContext';
import { normalizePhone } from '@/lib/driverProfile';
import { cn } from '@/lib/cn';
import { DOC_LABEL, KIND_LABEL, MY_STATES, STATUS_LABEL } from '@/lib/operatorLabels';
import { useT } from '@/lib/i18n';
import {
  deleteOperatorDoc,
  docUrls,
  fetchMyOperator,
  optionalDocs,
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
  const [t] = useT();
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
    <PagePanel title={t('Bisnes saya', 'My business')} subtitle={t('Senaraikan homestay, kereta sewa atau kedai makan anda di JalanGo', 'List your homestay, rental car or food business on JalanGo')}>
      {loading || (user && !loaded) ? (
        <Loader2 className="mx-auto mt-6 size-6 animate-spin text-ink-400" />
      ) : !user ? (
        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-ink-200 dark:bg-ink-900 dark:ring-ink-800">
          <p className="mb-3 text-sm text-ink-600 dark:text-ink-300">{t('Log masuk untuk daftar bisnes anda.', 'Sign in to register your business.')}</p>
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
  const [t] = useT();
  return (
    <div className="rounded-2xl bg-gradient-to-br from-jade-500/15 to-sky-500/10 p-4 text-sm ring-1 ring-jade-500/30">
      <p className="font-bold">{t('Promosikan bisnes anda kepada pemandu JalanGo', 'Promote your business to JalanGo drivers')}</p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-ink-700 dark:text-ink-200">
        <li><strong>{t('Percuma 6 bulan pertama', 'Free for the first 6 months')}</strong> {t('selepas diluluskan.', 'after approval.')}</li>
        <li>{t('Pelanggan hubungi anda terus melalui WhatsApp. JalanGo tidak mengambil komisen.', 'Customers contact you directly on WhatsApp. JalanGo takes no commission.')}</li>
        <li>{t('Semua operator disemak dahulu supaya pengguna percaya.', 'Every operator is checked first so users can trust them.')}</li>
        <li><strong>{t('Homestay:', 'Homestay:')}</strong> {t('IC pemilik + bukti pemilikan atau kebenaran.', 'Owner\'s IC + proof of ownership or permission.')}</li>
        <li><strong>{t('Kereta sewa:', 'Rental car:')}</strong> {t('SSM. Lesen APAD dan insurans digalakkan: operator berlesen mendapat lencana', 'SSM. An APAD licence and insurance are encouraged: licensed operators get the badge')} <strong>{t('Berlesen APAD', 'APAD licensed')}</strong>.</li>
      </ul>
    </div>
  );
}

function StatusCard({ operator, docs }: { operator: Operator; docs: OperatorDocument[] }) {
  const [t] = useT();
  const s = STATUS_LABEL[operator.status];
  const missing = requiredDocs(operator).filter((k) => !docs.some((d) => d.kind === k));
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-ink-200 dark:bg-ink-900 dark:ring-ink-800">
      <div className="flex items-center gap-2">
        <p className="min-w-0 flex-1 truncate font-bold">{operator.business_name}</p>
        <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold', s.tone)}>{t(s.text)}</span>
      </div>
      <p className="text-xs text-ink-500">{t(KIND_LABEL[operator.kind])} · {operator.town}, {operator.state}</p>
      {operator.review_note && operator.status !== 'approved' && operator.status !== 'pending' && (
        <p className="mt-2 rounded-xl bg-ink-100 p-2 text-sm dark:bg-ink-800">
          <strong>{t('Nota daripada JalanGo:', 'Note from JalanGo:')}</strong> {operator.review_note}
        </p>
      )}
      {operator.status === 'pending' && (
        <p className="mt-2 text-sm text-ink-600 dark:text-ink-300">
          {missing.length ? t(`Muat naik dokumen yang belum ada (${missing.length}) supaya kami boleh semak.`, `Upload the missing documents (${missing.length}) so we can review.`) : t('Terima kasih. Kami akan semak dalam masa terdekat.', 'Thank you. We\'ll review it shortly.')}
        </p>
      )}
      {operator.status === 'approved' && (
        <p className="mt-2 flex items-start gap-1.5 text-sm text-jade-700 dark:text-jade-300">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" /> {t('Bisnes anda disahkan.', 'Your business is verified.')}{operator.free_until && ` Percuma sehingga ${fmtDate(operator.free_until)}.`}
        </p>
      )}
    </div>
  );
}

function DetailsForm({ userId, operator, onSaved }: { userId: string; operator: Operator | null; onSaved: (o: Operator) => void }) {
  const [t] = useT();
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
    if (!phone || !phone.startsWith('60')) return setError(t('Masukkan nombor telefon/WhatsApp Malaysia, cth. 012-345 6789.', 'Enter a Malaysian phone/WhatsApp number, e.g. 012-345 6789.'));
    const licensed = car && Boolean(f.apad_licence_no?.trim());
    const insured = car && Boolean(f.insurance_expires_on);
    if (car && !f.ssm_no) return setError(t('Kereta sewa perlu No. SSM.', 'Car rental needs an SSM number.'));
    if (licensed && !f.apad_expires_on) return setError(t('Masukkan tarikh tamat lesen APAD.', 'Enter the APAD licence expiry date.'));
    if (car && (!licensed || !insured) && !agreed) return setError(t('Sila baca dan tandakan penafian.', 'Please read and tick the disclaimer.'));
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
      <p className="font-bold">{operator ? t('Maklumat bisnes', 'Business details') : t('1. Maklumat bisnes', '1. Business details')}</p>
      <fieldset disabled={locked || busy} className="space-y-3">
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label={t('Jenis bisnes', 'Business type')}>
          {(['homestay', 'car_rental', 'food'] as OperatorKind[]).map((k) => (
            <button key={k} type="button" role="radio" aria-checked={f.kind === k} onClick={() => set('kind', k)} disabled={Boolean(operator)} className={cn('flex flex-col items-center gap-1 rounded-xl p-3 text-sm font-semibold ring-2 disabled:cursor-not-allowed', f.kind === k ? 'bg-jade-500/10 ring-jade-500' : 'ring-ink-200 dark:ring-ink-700', operator && f.kind !== k && 'opacity-40')}>
              {k === 'homestay' ? <Home className="size-6" /> : k === 'car_rental' ? <Car className="size-6" /> : <Utensils className="size-6" />}
              {k === 'homestay' ? 'Homestay' : k === 'car_rental' ? t('Kereta sewa', 'Rental car') : t('Kedai makan', 'Food business')}
            </button>
          ))}
        </div>
        <label className="block text-sm font-semibold">{t('Nama bisnes', 'Business name')}<input className={input} value={f.business_name} maxLength={80} required onChange={(e) => set('business_name', e.target.value)} placeholder={car ? t('cth. Kereta Sewa Maju Sdn Bhd', 'e.g. Kereta Sewa Maju Sdn Bhd') : f.kind === 'food' ? t('cth. Warung Mak Teh Nasi Kerabu', 'e.g. Warung Mak Teh Nasi Kerabu') : t('cth. Homestay Pak Mat Pantai Cahaya Bulan', 'e.g. Homestay Pak Mat Pantai Cahaya Bulan')} /></label>
        <div className="grid grid-cols-2 gap-2">
          <label className="block text-sm font-semibold">{t('Negeri', 'State')}
            <select className={input} value={f.state} required onChange={(e) => set('state', e.target.value)}>
              <option value="">{t('Pilih…', 'Choose…')}</option>
              {MY_STATES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </label>
          <label className="block text-sm font-semibold">{t('Bandar / kawasan', 'Town / area')}<input className={input} value={f.town} maxLength={60} required onChange={(e) => set('town', e.target.value)} placeholder={t('cth. Kota Bharu', 'e.g. Kota Bharu')} /></label>
        </div>
        <label className="block text-sm font-semibold">{t('No. telefon / WhatsApp', 'Phone / WhatsApp number')}<input className={input} type="tel" inputMode="tel" value={f.phone} required onChange={(e) => set('phone', e.target.value)} placeholder="012-345 6789" /></label>
        <label className="block text-sm font-semibold">{t('No. SSM', 'SSM no.')} {car ? '' : t('(jika ada)', '(if any)')}<input className={input} value={f.ssm_no ?? ''} maxLength={30} required={car} onChange={(e) => set('ssm_no', e.target.value)} /></label>
        {car && (
          <>
            <label className="block text-sm font-semibold">{t('Insurans kenderaan tamat (jika ada)', 'Vehicle insurance expiry (if any)')}<span className="block text-xs font-normal text-ink-500">{t('Jika banyak kereta, isi tarikh yang paling awal tamat.', 'With several cars, enter the earliest expiry.')}</span><input className={input} type="date" value={f.insurance_expires_on ?? ''} onChange={(e) => set('insurance_expires_on', e.target.value)} /></label>
            <label className="block text-sm font-semibold">{t('No. lesen APAD (jika ada)', 'APAD licence no. (if any)')}<input className={input} value={f.apad_licence_no ?? ''} maxLength={40} onChange={(e) => set('apad_licence_no', e.target.value)} /></label>
            {f.apad_licence_no?.trim() && (
              <label className="block text-sm font-semibold">{t('Lesen APAD tamat', 'APAD licence expiry')}<input className={input} type="date" value={f.apad_expires_on ?? ''} required onChange={(e) => set('apad_expires_on', e.target.value)} /></label>
            )}
            {(!f.apad_licence_no?.trim() || !f.insurance_expires_on) && (
              <div className="rounded-xl bg-amber-400/15 p-3 text-xs leading-relaxed text-amber-900 dark:text-amber-100">
                <p className="font-bold">{t('Penafian:', 'Disclaimer:')} {!f.apad_licence_no?.trim() && !f.insurance_expires_on ? t('tanpa lesen APAD dan insurans', 'without an APAD licence and insurance') : !f.apad_licence_no?.trim() ? t('tanpa lesen APAD', 'without an APAD licence') : t('tanpa maklumat insurans', 'without insurance details')}</p>
                <p className="mt-1">
                  {t('Lesen APAD dan maklumat insurans tidak diwajibkan di JalanGo buat masa ini. Namun undang-undang Malaysia mungkin mewajibkan lesen untuk menyewakan kereta, dan insurans kereta persendirian biasanya tidak melindungi kegunaan sewa. Anda bertanggungjawab sepenuhnya untuk mematuhi undang-undang, insurans dan semua tuntutan berkaitan sewaan, termasuk kemalangan dan tuntutan pihak ketiga. JalanGo hanya menyenaraikan bisnes anda, tidak mengesahkan pematuhan anda, dan boleh mengubah syarat ini atau menggantung penyenaraian pada bila-bila masa. Pelanggan akan dimaklumkan jika anda tiada lesen APAD atau maklumat insurans.', 'An APAD licence and insurance details are not required on JalanGo for now. However, Malaysian law may require a licence to rent out cars, and private car insurance usually does not cover rental use. You are fully responsible for complying with the law, insurance and all claims related to rentals, including accidents and third-party claims. JalanGo only lists your business, does not verify your compliance, and may change these terms or suspend the listing at any time. Customers will be told if you have no APAD licence or insurance details.')}
                </p>
                <label className="mt-2 flex items-start gap-2 font-semibold">
                  <input type="checkbox" checked={agreed} onChange={(e) => { setAgreed(e.target.checked); setError(null); }} className="mt-0.5 size-4 accent-amber-600" />
                  {t('Saya faham dan bersetuju dengan penafian ini.', 'I understand and agree to this disclaimer.')}
                </label>
              </div>
            )}
          </>
        )}
        <label className="block text-sm font-semibold">{t('Penerangan ringkas (pilihan)', 'Short description (optional)')}<textarea className={cn(input, 'resize-none')} rows={3} maxLength={500} value={f.description ?? ''} onChange={(e) => set('description', e.target.value)} /></label>
      </fieldset>
      {operator && !locked && <p className="text-xs text-ink-500">{t('Menyimpan perubahan akan menghantar bisnes anda untuk disemak semula.', 'Saving changes sends your business for review again.')}</p>}
      {locked && <p className="text-sm text-red-600">{t('Bisnes ini digantung. Hubungi JalanGo melalui Profil → Maklum balas.', 'This business is suspended. Contact JalanGo via Profile → Feedback.')}</p>}
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {!locked && (
        <Button type="submit" className="w-full py-3" disabled={busy}>
          {busy && <Loader2 className="size-4 animate-spin" />} {saved ? <><CheckCircle2 className="size-4" /> {t('Disimpan', 'Saved')}</> : operator ? t('Simpan & hantar untuk semakan', 'Save & send for review') : t('Daftar & teruskan ke dokumen', 'Register & continue to documents')}
        </Button>
      )}
    </form>
  );
}

function Documents({ userId, operator, docs, onChange }: { userId: string; operator: Operator; docs: OperatorDocument[]; onChange: (d: OperatorDocument[]) => void }) {
  const [t] = useT();
  const [busy, setBusy] = useState<DocKind | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const kinds = useMemo<DocKind[]>(() => [...requiredDocs(operator), ...optionalDocs(operator), 'other'], [operator]);
  const requiredSet = useMemo(() => new Set(requiredDocs(operator)), [operator]);
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
      <p className="font-bold">{t('2. Dokumen pengesahan', '2. Verification documents')}</p>
      <p className="text-xs text-ink-500">{t('Gambar atau PDF. Dokumen hanya boleh dilihat oleh anda dan admin JalanGo, dan hanya digunakan untuk pengesahan.', 'Photo or PDF. Documents are only visible to you and JalanGo admins, and are only used for verification.')}</p>
      <ul className="space-y-2">
        {kinds.map((k) => {
          const mine = docs.filter((d) => d.kind === k);
          const required = requiredSet.has(k);
          return (
            <li key={k} className="rounded-xl bg-ink-100 p-3 dark:bg-ink-800">
              <div className="flex items-start gap-2">
                <span className="min-w-0 flex-1 text-sm font-semibold">
                  {mine.length ? <CheckCircle2 className="mr-1 inline size-4 text-jade-500" /> : required && <span className="mr-1 text-red-500">•</span>}
                  {t(DOC_LABEL[k])}
                </span>
                {!locked && (
                  <label className={cn('flex shrink-0 cursor-pointer items-center gap-1 rounded-lg bg-white px-2.5 py-1.5 text-xs font-semibold dark:bg-ink-700', busy && 'pointer-events-none opacity-60')}>
                    {busy === k ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />} {t('Muat naik', 'Upload')}
                    <input type="file" accept="image/*,application/pdf" className="sr-only" aria-label={t(`Muat naik ${t(DOC_LABEL[k])}`, `Upload ${t(DOC_LABEL[k])}`)} onChange={(e) => void upload(k, e.target.files?.[0])} />
                  </label>
                )}
              </div>
              {mine.map((d) => (
                <div key={d.id} className="mt-2 flex items-center gap-2 text-xs">
                  <FileText className="size-4 shrink-0 text-ink-400" />
                  {urls[d.path] ? <a href={urls[d.path]} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-sky-600">{t('Lihat (', 'View (')}{d.path.endsWith('.pdf') ? 'PDF' : t('gambar', 'photo')})</a> : <span className="flex-1 text-ink-500">{t('Dimuat naik', 'Uploaded')}</span>}
                  {!locked && (
                    <button type="button" onClick={() => void remove(d)} aria-label={t('Padam dokumen', 'Delete document')} className="grid size-7 place-items-center rounded-lg text-ink-400 hover:text-red-600">
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
