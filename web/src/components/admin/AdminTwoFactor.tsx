import { KeyRound, Loader2, ShieldCheck, Smartphone } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { startEnrollment, verifiedTotpFactor, verifyCode, type Enrollment } from '@/services/adminAuth';

/**
 * Two-factor gate for the admin page. First time: scan a QR code with an
 * authenticator app (Google Authenticator, Microsoft Authenticator, Authy…).
 * After that: a 6-digit code each time the admin signs in.
 */
export function AdminTwoFactor({ onVerified }: { onVerified: () => void }) {
  const [factorId, setFactorId] = useState<string | null>(null);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    verifiedTotpFactor()
      .then((f) => setFactorId(f?.id ?? null))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const begin = async () => {
    setBusy(true);
    setError(null);
    try {
      setEnrollment(await startEnrollment());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Tidak dapat mula 2FA');
    } finally {
      setBusy(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = enrollment?.factorId ?? factorId;
    if (!id) return;
    setBusy(true);
    setError(null);
    try {
      await verifyCode(id, code);
      onVerified();
    } catch {
      setError('Kod salah atau sudah tamat. Cuba kod terbaru dari aplikasi anda.');
      setCode('');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <Loader2 className="mx-auto mt-10 size-6 animate-spin text-ink-400" />;

  const codeForm = (
    <form onSubmit={submit} className="mt-4 space-y-3">
      <input
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9 ]{6,7}"
        maxLength={7}
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="123 456"
        aria-label="Kod 6 digit"
        className="w-full rounded-xl bg-ink-100 px-4 py-3 text-center text-2xl font-bold tracking-[0.3em] tabular-nums outline-none ring-jade-500 focus:ring-2 dark:bg-ink-800"
        autoFocus
      />
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <Button type="submit" className="w-full py-3" disabled={busy || code.replace(/\s/g, '').length !== 6}>
        {busy && <Loader2 className="size-4 animate-spin" />} Sahkan
      </Button>
    </form>
  );

  return (
    <div className="mx-auto max-w-sm rounded-3xl bg-white p-6 shadow-sm ring-1 ring-ink-200 dark:bg-ink-900 dark:ring-ink-800">
      <ShieldCheck className="mx-auto size-10 text-jade-500" />
      <h1 className="mt-2 text-center text-xl font-bold">Pengesahan dua langkah</h1>

      {factorId && !enrollment ? (
        <>
          <p className="mt-2 text-center text-sm text-ink-500">Masukkan kod 6 digit dari aplikasi pengesah anda untuk buka halaman Admin.</p>
          {codeForm}
        </>
      ) : enrollment ? (
        <>
          <ol className="mt-3 space-y-1 text-sm text-ink-600 dark:text-ink-300">
            <li>1. Buka aplikasi pengesah (Google Authenticator, Microsoft Authenticator atau Authy).</li>
            <li>2. Imbas kod QR ini.</li>
            <li>3. Masukkan kod 6 digit yang dipaparkan.</li>
          </ol>
          <img src={enrollment.qr} alt="Kod QR untuk aplikasi pengesah" className="mx-auto mt-3 size-48 rounded-xl bg-white p-2" />
          <details className="mt-2 text-xs text-ink-500">
            <summary className="cursor-pointer">Tak boleh imbas? Masukkan kunci ini</summary>
            <code className="mt-1 block break-all rounded-lg bg-ink-100 p-2 font-mono dark:bg-ink-800">{enrollment.secret}</code>
          </details>
          {codeForm}
        </>
      ) : (
        <>
          <p className="mt-2 text-center text-sm text-ink-500">
            Halaman Admin boleh meluluskan gambar dan menyekat pengguna, jadi ia perlukan kod dari telefon anda selain kata laluan.
          </p>
          {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}
          <Button className="mt-4 w-full py-3" onClick={() => void begin()} disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Smartphone className="size-4" />} Sediakan 2FA
          </Button>
          <p className="mt-3 flex items-start gap-1.5 text-[11px] text-ink-400">
            <KeyRound className="mt-0.5 size-3.5 shrink-0" /> Jika telefon hilang, 2FA boleh ditetapkan semula oleh pemilik projek melalui Supabase.
          </p>
        </>
      )}
    </div>
  );
}
