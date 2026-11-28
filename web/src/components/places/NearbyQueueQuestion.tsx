import { Check, HelpCircle, MapPinOff, Send, X } from 'lucide-react';
import { useState } from 'react';
import { useT, type Msg } from '@/lib/i18n';
import { answerQueue, type NearbyQueueRecord, type QueueAnswer } from '@/services/poiFeedbackService';
import type { Coordinates } from '@/types';
import { formatDistance } from '@/utils/geo';

const KIND: Record<string, Msg> = {
  restoran: { ms: 'kedai makan', en: 'place to eat' },
  penginapan: { ms: 'tempat penginapan', en: 'place to stay' },
  minyak: { ms: 'stesen minyak', en: 'petrol station' },
  bengkel: { ms: 'bengkel', en: 'workshop' },
  runcit: { ms: 'kedai runcit', en: 'shop' },
  kesihatan: { ms: 'klinik atau farmasi', en: 'clinic or pharmacy' },
  tarikan: { ms: 'tempat menarik', en: 'attraction' },
  ibadah: { ms: 'masjid atau surau', en: 'mosque or prayer room' },
};

/**
 * One record waiting for review, asked to someone standing near it (POI, owner
 * option A): its real name, whether its kind is right, or whether the public can
 * go in. Two nearby people giving the same answer settle it.
 */
export function NearbyQueueQuestion({ r, at, onDone, onSkip }: { r: NearbyQueueRecord; at: Coordinates; onDone: (settled: boolean) => void; onSkip: () => void }) {
  const [t] = useT();
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const kind = t(KIND[r.category] ?? { ms: 'tempat', en: 'place' });
  const near = r.distance_m <= 300;

  const send = async (answer: QueueAnswer) => {
    setBusy(true);
    setError(null);
    try {
      const res = await answerQueue(r.id, answer, at, answer === 'nama' ? name : undefined);
      onDone(res === 'approved' || res === 'rejected');
    } catch (e) {
      const m = e instanceof Error ? e.message : '';
      if (m === 'nama_generik') setError(t('Tulis nama penuh, contohnya “Surau Al-Hidayah”.', 'Write the full name, e.g. “Surau Al-Hidayah”.'));
      else if (m === 'rate_limited') setError(t('Had jawapan hari ini sudah dicapai. Cuba esok.', 'Daily answer limit reached. Try tomorrow.'));
      else setError(t('Tak dapat hantar. Cuba lagi.', 'Could not send. Try again.'));
    } finally {
      setBusy(false);
    }
  };

  const title =
    r.question === 'nama'
      ? r.category === 'ibadah'
        ? t('Ada masjid atau surau di sini? Apa namanya?', 'Is there a mosque or prayer room here? What is it called?')
        : t(`Apa nama sebenar ${kind} ini${r.name ? ` (“${r.name}”)` : ''}?`, `What is this ${kind} really called${r.name ? ` (“${r.name}”)` : ''}?`)
      : r.question === 'kategori'
        ? t(`Adakah “${r.name}” sebuah ${kind}?`, `Is “${r.name}” a ${kind}?`)
        : t(`Boleh orang awam masuk ke “${r.name}”?`, `Can the public go into “${r.name}”?`);

  return (
    <div className="pointer-events-auto rounded-2xl bg-white p-3 shadow-float ring-1 ring-ink-900/5 dark:bg-ink-800 dark:ring-white/10">
      <div className="flex items-start gap-2">
        <HelpCircle className="mt-0.5 size-5 shrink-0 text-violet-500" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">{title}</p>
          <p className="text-xs text-ink-500">
            {formatDistance(r.distance_m)} {t('dari anda · bantu sahkan tempat dalam JalanGo', 'from you · help confirm places in JalanGo')}
          </p>
        </div>
        <button type="button" onClick={onSkip} aria-label={t('Langkau', 'Skip')} className="grid size-8 shrink-0 place-items-center rounded-full text-ink-400 hover:bg-ink-100 dark:hover:bg-ink-700">
          <X className="size-4" />
        </button>
      </div>
      {!near ? (
        <p className="mt-1 text-xs text-ink-500">{t('Dekati tempat itu (dalam 300 m) untuk menjawab.', 'Get within 300 m of the place to answer.')}</p>
      ) : r.question === 'nama' ? (
        <form
          className="mt-2 space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim().length >= 3) void send('nama');
          }}
        >
          <div className="flex gap-2">
            <input value={name} onChange={(e) => setName(e.target.value.slice(0, 120))} placeholder={t('Nama pada papan tanda', 'Name on the signboard')} aria-label={t('Nama tempat', 'Place name')} className="min-w-0 flex-1 rounded-xl bg-ink-100 px-3 py-2 text-sm dark:bg-ink-700" />
            <button type="submit" disabled={busy || name.trim().length < 3} className="flex items-center gap-1 rounded-xl bg-jade-500 px-3 py-2 text-sm font-bold text-ink-950 disabled:opacity-50">
              <Send className="size-4" /> {t('Hantar', 'Send')}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" disabled={busy} onClick={() => void send('tiada')} className="flex items-center justify-center gap-1 rounded-xl bg-ink-100 py-2 text-xs font-semibold dark:bg-ink-700">
              <MapPinOff className="size-4" /> {t('Tiada di sini', 'Not here')}
            </button>
            <button type="button" disabled={busy} onClick={onSkip} className="flex items-center justify-center gap-1 rounded-xl bg-ink-100 py-2 text-xs font-semibold dark:bg-ink-700">
              <HelpCircle className="size-4" /> {t('Tak tahu', 'Don’t know')}
            </button>
          </div>
        </form>
      ) : (
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button type="button" disabled={busy} onClick={() => void send(r.question === 'kategori' ? 'kategori_ya' : 'awam_ya')} className="flex items-center justify-center gap-1 rounded-xl bg-jade-500 py-2 text-sm font-bold text-ink-950">
            <Check className="size-4" /> {t('Ya', 'Yes')}
          </button>
          <button type="button" disabled={busy} onClick={() => void send(r.question === 'kategori' ? 'kategori_tidak' : 'awam_tidak')} className="flex items-center justify-center gap-1 rounded-xl bg-red-600 py-2 text-sm font-bold text-white">
            <X className="size-4" /> {t('Tidak', 'No')}
          </button>
          <button type="button" disabled={busy} onClick={() => void send('tiada')} className="flex items-center justify-center gap-1 rounded-xl bg-ink-100 py-2 text-xs font-semibold dark:bg-ink-700">
            <MapPinOff className="size-4" /> {t('Tiada di sini', 'Not here')}
          </button>
          <button type="button" disabled={busy} onClick={onSkip} className="flex items-center justify-center gap-1 rounded-xl bg-ink-100 py-2 text-xs font-semibold dark:bg-ink-700">
            <HelpCircle className="size-4" /> {t('Tak pasti', 'Not sure')}
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-1 text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      <p className="mt-2 text-[11px] text-ink-400">{t('Akaun dan jawapan anda sahaja disimpan, bukan lokasi anda.', 'Only your account and answer are kept, not your location.')}</p>
    </div>
  );
}
