import { Camera, CheckCircle2, Loader2, ShieldCheck, X } from 'lucide-react';
import { useState } from 'react';
import { AuthForm } from '@/components/auth/AuthForm';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { useAccidents } from '@/contexts/AccidentsContext';
import { useAuth } from '@/contexts/AuthContext';
import { OUTCOMES, todayMY, VEHICLES } from '@/lib/accidentLabels';
import { cn } from '@/lib/cn';
import { useT } from '@/lib/i18n';
import type { AccidentOutcome, AccidentVehicle, Coordinates } from '@/types';

/** Add a crash at a spot: today's or a past one (up to 2 years), optional photo for admin review. */
export function AddAccidentSheet({ at, placeName, onClose }: { at: Coordinates; placeName?: string; onClose: () => void }) {
  const [t, lang] = useT();
  const { user } = useAuth();
  const { available, add } = useAccidents();
  const today = todayMY();
  const min = todayMY(new Date(Date.now() - 730 * 86_400_000));
  const [date, setDate] = useState(today);
  const [timeOfDay, setTimeOfDay] = useState<'day' | 'night' | null>(null);
  const [vehicles, setVehicles] = useState<AccidentVehicle[]>([]);
  const [outcome, setOutcome] = useState<AccidentOutcome>('unknown');
  const [note, setNote] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const toggle = (v: AccidentVehicle) => setVehicles((s) => (s.includes(v) ? s.filter((x) => x !== v) : s.length >= 4 ? s : [...s, v]));
  const pick = (f: File | null) => {
    if (preview) URL.revokeObjectURL(preview);
    setPhoto(f);
    setPreview(f ? URL.createObjectURL(f) : null);
    setAgreed(false);
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await add({ latitude: at.lat, longitude: at.lng, occurredOn: date, timeOfDay, vehicles, outcome, note }, photo);
      setDone(true);
      setTimeout(onClose, 1600);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('Tidak dapat simpan rekod', 'Could not save the record'));
    } finally {
      setBusy(false);
    }
  };

  const chip = (on: boolean) => cn('rounded-full px-3 py-1.5 text-sm font-medium', on ? 'bg-red-600 text-white' : 'bg-ink-100 dark:bg-ink-800');
  let body: React.ReactNode;
  if (!available) body = <p className="text-sm text-ink-500">{t('Ciri komuniti belum disambungkan.', 'Community features aren’t connected yet.')}</p>;
  else if (!user) body = <AuthForm compact />;
  else if (done)
    body = (
      <div className="flex flex-col items-center py-4 text-center">
        <CheckCircle2 className="size-12 text-jade-500" />
        <p className="mt-2 font-semibold">{t('Rekod disimpan. Terima kasih kerana membantu pemandu lain.', 'Saved. Thank you for helping other drivers.')}</p>
        {photo && <p className="mt-1 text-xs text-ink-500">{t('Gambar akan dipaparkan selepas disemak admin.', 'The photo will show after review.')}</p>}
      </div>
    );
  else
    body = (
      <div className="space-y-4">
        <p className="rounded-xl bg-ink-100 p-3 text-sm dark:bg-ink-800">
          📍 {placeName ?? `${at.lat.toFixed(5)}, ${at.lng.toFixed(5)}`}
        </p>
        <label className="block text-sm font-semibold">
          {t('Tarikh kemalangan', 'Date of the crash')}
          <input type="date" value={date} min={min} max={today} onChange={(e) => setDate(e.target.value)} className="mt-1 w-full rounded-xl bg-ink-100 px-3 py-2.5 text-base font-normal dark:bg-ink-800" />
        </label>
        <div>
          <p className="mb-1.5 text-sm font-semibold">{t('Waktu', 'Time')}</p>
          <div className="flex gap-2">
            <button type="button" className={chip(timeOfDay === 'day')} onClick={() => setTimeOfDay(timeOfDay === 'day' ? null : 'day')}>☀️ {t('Siang', 'Day')}</button>
            <button type="button" className={chip(timeOfDay === 'night')} onClick={() => setTimeOfDay(timeOfDay === 'night' ? null : 'night')}>🌙 {t('Malam', 'Night')}</button>
          </div>
        </div>
        <div>
          <p className="mb-1.5 text-sm font-semibold">{t('Kenderaan terlibat', 'Vehicles involved')}</p>
          <div className="flex flex-wrap gap-2">
            {VEHICLES.map((v) => (
              <button key={v.id} type="button" className={chip(vehicles.includes(v.id))} onClick={() => toggle(v.id)} aria-pressed={vehicles.includes(v.id)}>
                {v.emoji} {lang === 'en' ? v.en : v.ms}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-1.5 text-sm font-semibold">{t('Mangsa', 'Casualties')}</p>
          <div className="flex flex-wrap gap-2">
            {OUTCOMES.map((o) => (
              <button key={o.id} type="button" className={chip(outcome === o.id)} onClick={() => setOutcome(o.id)} aria-pressed={outcome === o.id}>
                {lang === 'en' ? o.en : o.ms}
              </button>
            ))}
          </div>
        </div>
        <textarea rows={2} maxLength={280} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('Nota (pilihan), cth. simpang tiada lampu isyarat', 'Note (optional), e.g. junction has no traffic lights')} aria-label={t('Nota', 'Note')} className="w-full resize-none rounded-xl bg-ink-100 px-3 py-2.5 text-base dark:bg-ink-800" />

        <div>
          <p className="mb-1.5 text-sm font-semibold">{t('Gambar lokasi (pilihan)', 'Photo of the spot (optional)')}</p>
          {preview ? (
            <div className="relative">
              <img src={preview} alt="" className="max-h-48 w-full rounded-xl object-cover" />
              <button type="button" onClick={() => pick(null)} aria-label={t('Buang gambar', 'Remove photo')} className="absolute right-2 top-2 grid size-8 place-items-center rounded-full bg-ink-950/70 text-white">
                <X className="size-4" />
              </button>
            </div>
          ) : (
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-ink-300 py-4 text-sm font-semibold text-ink-600 dark:border-ink-700 dark:text-ink-300">
              <Camera className="size-5" /> {t('Ambil / pilih gambar', 'Take / choose a photo')}
              <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => pick(e.target.files?.[0] ?? null)} />
            </label>
          )}
          {photo && (
            <label className="mt-2 flex items-start gap-2 text-xs text-ink-600 dark:text-ink-300">
              <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5 size-4 accent-red-600" />
              {t('Gambar ini tidak menunjukkan mangsa, muka orang atau nombor plat yang jelas.', 'This photo doesn’t clearly show victims, faces or number plates.')}
            </label>
          )}
          <p className="mt-2 flex items-start gap-1.5 text-[11px] text-ink-500">
            <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-jade-500" />
            {t('Gambar disemak admin sebelum dipaparkan. Lokasi GPS dan maklumat kamera dalam gambar dibuang sebelum dimuat naik.', 'Photos are reviewed before they appear. GPS and camera details in the photo are removed before upload.')}
          </p>
        </div>

        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        <Button className="w-full bg-red-600 py-3 text-white hover:bg-red-700" onClick={submit} disabled={busy || (photo !== null && !agreed)}>
          {busy && <Loader2 className="size-4 animate-spin" />} {t('Simpan rekod', 'Save record')}
        </Button>
      </div>
    );

  return (
    <Sheet title={t('Rekod kemalangan', 'Record an accident')} onClose={onClose}>
      {body}
    </Sheet>
  );
}
