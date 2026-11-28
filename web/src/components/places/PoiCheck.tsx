import { Check, MapPinOff, PencilLine, Store, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation } from '@/contexts/LocationContext';
import { useT } from '@/lib/i18n';
import { myPoiFeedback, sendPoiFeedback, type MyPoiFeedback, type PoiFeedbackKind } from '@/services/poiFeedbackService';
import { areaFor, loadAreas } from '@/utils/myAreas';

/**
 * "Betul ke maklumat ni?" on a JalanGo POI (OpenStreetMap place). Signed-in people
 * say whether it is still open, closed, in the wrong place, or suggest its name.
 * Two nearby people agreeing on open / closed settles it; the rest goes to an admin.
 */
export function PoiCheck({ poiId, unverified = false, at = null }: { poiId: string; unverified?: boolean; at?: { lat: number; lng: number } | null }) {
  const [t] = useT();
  const { user } = useAuth();
  const { fix } = useLocation();
  const [mine, setMine] = useState<MyPoiFeedback | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');

  useEffect(() => {
    if (!user) return;
    let alive = true;
    myPoiFeedback(poiId)
      .then((m) => alive && setMine(m))
      .catch(() => alive && setMine({ answered: [], verification: null, confirmations: 0 }));
    return () => {
      alive = false;
    };
  }, [poiId, user]);

  const send = async (kind: PoiFeedbackKind, suggested?: string) => {
    setBusy(true);
    setMsg(null);
    try {
      await sendPoiFeedback(poiId, kind, fix?.coordinates ?? null, suggested, at ? areaFor(at, loadAreas()) : null);
      setMine((m) => ({ answered: [...(m?.answered ?? []), kind], verification: m?.verification ?? null, confirmations: m?.confirmations ?? 0 }));
      setNaming(false);
      setMsg(t('Terima kasih! Jawapan anda membantu orang lain.', 'Thank you! Your answer helps others.'));
    } catch (e) {
      setMsg(e instanceof Error && e.message === 'rate_limited' ? t('Had jawapan hari ini sudah dicapai. Cuba esok.', 'Daily answer limit reached. Try tomorrow.') : t('Tak dapat hantar. Cuba lagi.', 'Could not send. Try again.'));
    } finally {
      setBusy(false);
    }
  };

  const done = (k: PoiFeedbackKind) => mine?.answered.includes(k) ?? false;
  // Signed out: what search said (the database answers for signed-in people)
  const v = mine?.verification ?? (unverified ? 'belum' : null);

  return (
    <section aria-label={t('Semak maklumat tempat', 'Check this place')} className="mt-3 rounded-2xl bg-ink-100/70 p-3 text-sm dark:bg-ink-800/60">
      <div className="flex flex-wrap items-center gap-2">
        <p className="min-w-0 flex-1 font-semibold">{t('Betul ke maklumat ni?', 'Is this right?')}</p>
        {v === 'disahkan_komuniti' && (
          <span className="rounded-full bg-jade-500/15 px-2 py-0.5 text-[11px] font-semibold text-jade-700 dark:text-jade-300">
            {mine && mine.confirmations > 0 ? t(`Disahkan oleh ${mine.confirmations} orang`, `Confirmed by ${mine.confirmations} people`) : t('Disahkan komuniti', 'Confirmed by the community')}
          </span>
        )}
        {v === 'belum' && <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:text-amber-200">{t('Belum disahkan', 'Not confirmed yet')}</span>}
        {v === 'perlu_pengesahan' && <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:text-amber-200">{t('Data lama, perlu disahkan', 'Old data, needs checking')}</span>}
      </div>
      {!user ? (
        <p className="mt-1 text-xs text-ink-500">{t('Log masuk untuk sahkan tempat ini.', 'Sign in to check this place.')}</p>
      ) : (
        <>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Button variant="secondary" className="px-2 py-2 text-xs" disabled={busy || done('masih_beroperasi') || done('sudah_tutup')} aria-pressed={done('masih_beroperasi')} onClick={() => send('masih_beroperasi')}>
              <Check className="size-4 text-jade-600" /> {t('Masih buka', 'Still open')}
            </Button>
            <Button variant="secondary" className="px-2 py-2 text-xs" disabled={busy || done('sudah_tutup') || done('masih_beroperasi')} aria-pressed={done('sudah_tutup')} onClick={() => send('sudah_tutup')}>
              <Store className="size-4 text-red-500" /> {t('Sudah tutup', 'Closed')}
            </Button>
            <Button variant="secondary" className="px-2 py-2 text-xs" disabled={busy || done('lokasi_salah')} aria-pressed={done('lokasi_salah')} onClick={() => send('lokasi_salah')}>
              <MapPinOff className="size-4" /> {t('Lokasi salah', 'Wrong place')}
            </Button>
            <Button variant="secondary" className="px-2 py-2 text-xs" disabled={busy || done('nama_dicadangkan')} aria-pressed={done('nama_dicadangkan')} onClick={() => setNaming((x) => !x)}>
              <PencilLine className="size-4" /> {t('Cadang nama', 'Suggest name')}
            </Button>
          </div>
          {naming && !done('nama_dicadangkan') && (
            <form
              className="mt-2 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (name.trim().length >= 2) void send('nama_dicadangkan', name);
              }}
            >
              <input value={name} onChange={(e) => setName(e.target.value.slice(0, 120))} placeholder={t('Nama sebenar tempat ini', 'The real name of this place')} aria-label={t('Nama dicadangkan', 'Suggested name')} className="min-w-0 flex-1 rounded-xl bg-white px-3 py-2 text-sm dark:bg-ink-900" />
              <Button type="submit" className="px-3 py-2 text-xs" disabled={busy || name.trim().length < 2}>
                {t('Hantar', 'Send')}
              </Button>
              <Button variant="ghost" className="px-2 py-2" aria-label={t('Batal', 'Cancel')} onClick={() => setNaming(false)}>
                <X className="size-4" />
              </Button>
            </form>
          )}
          <p className="mt-2 text-[11px] text-ink-400">{t('Akaun dan jawapan anda sahaja disimpan, bukan lokasi anda.', 'Only your account and answer are kept, not your location.')}</p>
        </>
      )}
      {msg && (
        <p role="status" className="mt-1 text-xs text-ink-600 dark:text-ink-300">
          {msg}
        </p>
      )}
    </section>
  );
}
