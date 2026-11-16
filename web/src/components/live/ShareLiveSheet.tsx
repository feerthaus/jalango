import { Check, Copy, Loader2, MessageCircle, Radio, Share2, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { AuthForm } from '@/components/auth/AuthForm';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { useAuth } from '@/contexts/AuthContext';
import { useLiveShare } from '@/contexts/LiveShareContext';
import { useRouting } from '@/contexts/RoutingContext';
import { cn } from '@/lib/cn';
import { shareUrl, type LiveShare } from '@/services/liveShareService';
import { normalizePhone, normalizePlate, useDriverProfile } from '@/lib/driverProfile';
import { useT } from '@/lib/i18n';

const DURATIONS = [
  { id: '15', label: { ms: '15 min', en: '15 min' }, minutes: 15 },
  { id: '60', label: { ms: '1 jam', en: '1 hour' }, minutes: 60 },
  { id: '480', label: { ms: '8 jam', en: '8 hours' }, minutes: 480 },
] as const;

/** Create a private live-location link for friends & family. */
export function ShareLiveSheet({ onClose }: { onClose: () => void }) {
  const [t] = useT();
  const { user } = useAuth();
  const { available, start } = useLiveShare();
  const { status, destination } = useRouting();
  const navigating = status === 'navigating';
  const [name, setName] = useState(((user?.user_metadata?.name as string | undefined) || user?.email?.split('@')[0] || '').slice(0, 40));
  const [duration, setDuration] = useState<string>(navigating ? 'trip' : '60');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<LiveShare | null>(null);
  const [driver, setDriver] = useDriverProfile();
  const plate = normalizePlate(driver.plate);
  const phone = driver.phone.trim() ? normalizePhone(driver.phone) : null;
  const driverInvalid = driver.enabled && (!plate || !driver.vehicle.trim() || (driver.phone.trim() !== '' && !phone));

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      const minutes = duration === 'trip' ? 720 : Number(duration);
      setCreated(
        await start({
          displayName: name,
          minutes,
          untilArrival: duration === 'trip',
          driver: driver.enabled && plate ? { vehicle: driver.vehicle.trim(), plate, phone } : null,
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start sharing');
    } finally {
      setBusy(false);
    }
  };

  if (!user) {
    return (
      <Sheet title={t('Kongsi lokasi live', 'Share live location')} onClose={onClose}>
        <p className="mb-3 text-sm text-ink-600 dark:text-ink-300">{t('Log masuk supaya orang yang anda kongsi tahu itu memang anda.', 'Sign in so the people you share with know it’s really you.')}</p>
        <AuthForm compact />
      </Sheet>
    );
  }
  if (!available) {
    return (
      <Sheet title={t('Kongsi lokasi live', 'Share live location')} onClose={onClose}>
        <p className="text-sm text-ink-500">{t('Kongsi lokasi live belum disambungkan.', 'Live sharing isn’t connected yet.')}</p>
      </Sheet>
    );
  }

  return (
    <Sheet title={t('Kongsi lokasi live', 'Share live location')} onClose={onClose}>
      {created ? <ShareLinkActions share={created} onDone={onClose} /> : (
        <div className="space-y-3">
          <p className="text-sm text-ink-600 dark:text-ink-300">
            {t('Sesiapa yang ada pautan boleh lihat di mana anda', 'Anyone with the link can see where you are')}{navigating && destination ? t(` dan anggaran masa tiba anda ke ${destination.name}`, ` and your ETA to ${destination.name}`) : ''} {t('— tanpa perlu app.', '— no app needed.')}
          </p>
          <label className="block text-sm">
            <span className="font-medium">{t('Nama anda pada pautan', 'Your name on the link')}</span>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder={t('cth. Firdaus', 'e.g. Firdaus')} className="mt-1 w-full rounded-xl bg-ink-100 px-3 py-2.5 text-base outline-none ring-jade-500 focus:ring-2 dark:bg-ink-800" />
          </label>
          <div role="radiogroup" aria-label={t('Berapa lama', 'How long')} className="grid grid-cols-2 gap-2">
            {navigating && <Choice id="trip" label={t('Sehingga saya sampai', 'Until I arrive')} current={duration} onPick={setDuration} />}
            {DURATIONS.map((d) => (
              <Choice key={d.id} id={d.id} label={t(d.label)} current={duration} onPick={setDuration} />
            ))}
          </div>
          <DriverFields driver={driver} setDriver={setDriver} plateOk={Boolean(plate)} phoneOk={driver.phone.trim() === '' || Boolean(phone)} />
          <p className="flex items-start gap-2 text-xs text-ink-500 dark:text-ink-400">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-jade-500" />
            {t('Hanya kedudukan terkini anda dikongsi, tidak pernah sejarahnya. Hentikan bila-bila masa — lokasi dipadam serta-merta.', 'Only your latest position is shared, never your history. Stop any time — the location is deleted straight away.')}
          </p>
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
          <Button className="w-full py-3" onClick={create} disabled={busy || !name.trim() || driverInvalid}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Radio className="size-4" />} {t('Mula kongsi', 'Start sharing')}
          </Button>
        </div>
      )}
    </Sheet>
  );
}

function Choice({ id, label, current, onPick }: { id: string; label: string; current: string; onPick: (id: string) => void }) {
  return (
    <button type="button" role="radio" aria-checked={current === id} onClick={() => onPick(id)} className={cn('rounded-xl py-2.5 text-sm font-semibold ring-2', current === id ? 'bg-jade-500/10 ring-jade-500' : 'bg-ink-100 ring-transparent dark:bg-ink-800')}>
      {label}
    </button>
  );
}

export function ShareLinkActions({ share, onDone }: { share: LiveShare; onDone?: () => void }) {
  const [t] = useT();
  const [copied, setCopied] = useState(false);
  const url = shareUrl(share.token);
  const text = share.driver_plate
    ? `Your driver ${share.display_name} (${share.driver_plate}) is on the way. Track live / Jejak secara langsung`
    : `${share.display_name} is sharing their live location with you on JalanGo`;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };
  return (
    <div className="space-y-3">
      <p className="flex items-center gap-2 rounded-xl bg-jade-500/10 p-3 text-sm font-semibold text-jade-700 dark:text-jade-300">
        <Radio className="size-4 animate-pulse" /> {t('Anda sedang berkongsi lokasi live', 'You’re sharing your live location')}
      </p>
      <p className="break-all rounded-xl bg-ink-100 p-3 font-mono text-xs dark:bg-ink-800">{url}</p>
      <div className="grid grid-cols-3 gap-2">
        <a href={`https://wa.me/?text=${encodeURIComponent(`${text}: ${url}`)}`} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-1.5 rounded-xl bg-[#25D366] py-2.5 text-sm font-semibold text-white">
          <MessageCircle className="size-4" /> WhatsApp
        </a>
        <Button variant="secondary" onClick={copy}>
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />} {copied ? t('Disalin', 'Copied') : t('Salin', 'Copy')}
        </Button>
        <Button variant="secondary" onClick={() => navigator.share?.({ title: 'JalanGo live location', text, url }).catch(() => {})} disabled={typeof navigator.share !== 'function'}>
          <Share2 className="size-4" /> {t('Lain', 'More')}
        </Button>
      </div>
      {onDone && (
        <Button variant="ghost" className="w-full" onClick={onDone}>
          {t('Selesai', 'Done')}
        </Button>
      )}
    </div>
  );
}

/** Driver mode: what the customer sees on the link (car, plate, WhatsApp, next stop). */
function DriverFields({
  driver,
  setDriver,
  plateOk,
  phoneOk,
}: {
  driver: ReturnType<typeof useDriverProfile>[0];
  setDriver: ReturnType<typeof useDriverProfile>[1];
  plateOk: boolean;
  phoneOk: boolean;
}) {
  const [t] = useT();
  const input = 'mt-1 w-full rounded-xl bg-ink-100 px-3 py-2.5 text-base outline-none ring-jade-500 focus:ring-2 dark:bg-ink-800';
  return (
    <div className="rounded-2xl bg-ink-50 p-3 dark:bg-ink-800/50">
      <label className="flex items-center gap-3">
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">{t('Mod Driver (untuk pelanggan)', 'Driver mode (for customers)')}</span>
          <span className="block text-xs text-ink-500">{t('Pelanggan nampak kenderaan, nombor plat dan hentian seterusnya.', 'Customers see your vehicle, plate number and next stop.')}</span>
        </span>
        <input type="checkbox" checked={driver.enabled} onChange={(e) => setDriver({ enabled: e.target.checked })} className="size-5 accent-jade-500" />
      </label>
      {driver.enabled && (
        <div className="mt-3 space-y-2">
          <label className="block text-sm">
            <span className="font-medium">{t('Kenderaan', 'Vehicle')}</span>
            <input value={driver.vehicle} onChange={(e) => setDriver({ vehicle: e.target.value.slice(0, 60) })} placeholder={t('cth. Toyota Alphard hitam', 'e.g. black Toyota Alphard')} className={input} />
          </label>
          <label className="block text-sm">
            <span className="font-medium">{t('Nombor plat', 'Plate number')}</span>
            <input value={driver.plate} onChange={(e) => setDriver({ plate: e.target.value.toUpperCase().slice(0, 14) })} placeholder={t('cth. WXY 1234', 'e.g. WXY 1234')} autoCapitalize="characters" className={input} />
            {driver.plate && !plateOk && <span className="text-xs text-red-600">{t('Huruf, nombor dan ruang sahaja (2–12 aksara).', 'Letters, numbers and spaces only (2–12 characters).')}</span>}
          </label>
          <label className="block text-sm">
            <span className="font-medium">{t('WhatsApp untuk pelanggan (pilihan)', 'WhatsApp for customers (optional)')}</span>
            <input value={driver.phone} onChange={(e) => setDriver({ phone: e.target.value.slice(0, 20) })} placeholder={t('cth. 012-345 6789', 'e.g. 012-345 6789')} inputMode="tel" className={input} />
            {!phoneOk && <span className="text-xs text-red-600">{t('Nombor telefon tak sah.', 'Invalid phone number.')}</span>}
          </label>
          <p className="text-xs text-ink-500">
            {t('Hentian seterusnya diambil dari', 'The next stop comes from your')} <strong>{t('Itinerari', 'Itinerary')}</strong> {t('anda. Nombor telefon dipadam sebaik perkongsian dihentikan.', '. The phone number is deleted as soon as sharing stops.')}
          </p>
        </div>
      )}
    </div>
  );
}
