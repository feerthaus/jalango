import { Keyboard, Loader2, Mic, MicOff, RotateCcw, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from '@/contexts/LocationContext';
import { useRouting } from '@/contexts/RoutingContext';
import { useSavedPlaces } from '@/contexts/SavedPlacesContext';
import { useServiceStatus } from '@/contexts/ServiceStatusContext';
import { useSpeechRecognition, type SpeechError } from '@/hooks/useSpeechRecognition';
import { speak } from '@/hooks/useVoiceAlerts';
import { cn } from '@/lib/cn';
import { useT } from '@/lib/i18n';
import { searchPlaces } from '@/services/geocodingService';
import { formatDistance, haversineMeters } from '@/utils/geo';
import { cleanVoiceQuery } from '@/utils/voiceQuery';

type Phase = { kind: 'listening' } | { kind: 'searching'; query: string } | { kind: 'notFound'; query: string } | { kind: 'error'; error: SpeechError | 'search' };

/**
 * Hands-free destination search: tap the mic, say the place ("Awana SkyWay",
 * "bawa saya ke KLCC"), and JalanGo plans the route to the best match and
 * reads it out. Only one tap ("Mula") is left to start driving.
 */
export function VoiceSearchButton({ onTypeInstead, className }: { onTypeInstead: (text: string) => void; className?: string }) {
  const [t] = useT();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t('Cari dengan suara', 'Search by voice')}
        className={cn('grid size-10 shrink-0 place-items-center rounded-xl text-jade-600 hover:bg-ink-100 dark:text-jade-400 dark:hover:bg-ink-700', className)}
      >
        <Mic className="size-5" />
      </button>
      {open && (
        <VoiceSearchSheet
          onClose={() => setOpen(false)}
          onTypeInstead={(text) => {
            setOpen(false);
            onTypeInstead(text);
          }}
        />
      )}
    </>
  );
}

function VoiceSearchSheet({ onClose, onTypeInstead }: { onClose: () => void; onTypeInstead: (text: string) => void }) {
  const [t, lang] = useT();
  const speech = useSpeechRecognition(lang === 'en' ? 'en-MY' : 'ms-MY');
  const { fix } = useLocation();
  const { searchMode } = useServiceStatus();
  const { planRoute } = useRouting();
  const { addRecent } = useSavedPlaces();
  const [phase, setPhase] = useState<Phase>({ kind: 'listening' });
  const runId = useRef(0);

  const run = useCallback(async () => {
    setPhase({ kind: 'listening' });
    const id = ++runId.current;
    const said = await speech.listen();
    if (id !== runId.current) return; // a newer attempt (or close) replaced this one
    if (!said) return; // error / silence handled below from speech.error
    const query = cleanVoiceQuery(said);
    setPhase({ kind: 'searching', query });
    try {
      const near = fix ? fix.coordinates : null;
      const { results } = await searchPlaces(query, { near, live: searchMode === 'live' });
      if (id !== runId.current) return;
      const best = results[0];
      if (!best) {
        setPhase({ kind: 'notFound', query });
        speak(t(`Tidak jumpa ${query}. Cuba sebut sekali lagi.`, `Couldn't find ${query}. Please try again.`), lang, { interrupt: true });
        return;
      }
      addRecent(best);
      planRoute(best);
      const dist = near ? `, ${formatDistance(haversineMeters(near, best.coordinates))}` : '';
      speak(t(`Laluan ke ${best.name}${dist}. Tekan Mula untuk bergerak.`, `Route to ${best.name}${dist}. Tap Start to go.`), lang, { interrupt: true });
      onClose();
    } catch {
      setPhase({ kind: 'error', error: 'search' });
    }
  }, [speech, fix, searchMode, addRecent, planRoute, t, lang, onClose]);

  // Start listening as soon as the sheet opens
  useEffect(() => {
    void run();
    return () => {
      runId.current++;
      speech.cancel();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Silence / permission / unsupported → show why
  useEffect(() => {
    if (speech.error && phase.kind === 'listening' && !speech.listening) setPhase({ kind: 'error', error: speech.error });
  }, [speech.error, speech.listening, phase.kind]);
  useEffect(() => {
    if (!speech.listening && !speech.error && phase.kind === 'listening' && speech.interim === '') {
      // ended with nothing heard and no error event (some browsers)
      const id = setTimeout(() => setPhase((p) => (p.kind === 'listening' ? { kind: 'error', error: 'no-speech' } : p)), 400);
      return () => clearTimeout(id);
    }
  }, [speech.listening, speech.error, speech.interim, phase.kind]);

  const errorText = (e: SpeechError | 'search') =>
    ({
      'not-allowed': t('Akses mikrofon disekat. Benarkan mikrofon untuk JalanGo dalam tetapan pelayar, kemudian cuba lagi.', 'Microphone access is blocked. Allow the microphone for JalanGo in your browser settings, then try again.'),
      'no-speech': t('Tiada suara didengar. Tekan Cuba lagi dan sebut nama tempat.', 'No speech heard. Tap Try again and say the place name.'),
      network: t('Carian suara perlukan internet. Semak sambungan anda.', 'Voice search needs internet. Check your connection.'),
      unsupported: t('Pelayar ini tidak menyokong carian suara. Guna Chrome (Android) atau Safari (iPhone), atau tekan mic pada papan kekunci.', 'This browser doesn’t support voice search. Use Chrome (Android) or Safari (iPhone), or the mic on your keyboard.'),
      other: t('Carian suara tidak berjaya. Cuba lagi.', 'Voice search didn’t work. Please try again.'),
      search: t('Carian gagal. Semak sambungan anda dan cuba lagi.', 'Search failed. Check your connection and try again.'),
    })[e];

  const listening = phase.kind === 'listening' && speech.listening;

  return createPortal(
    <div className="pointer-events-auto fixed inset-0 z-[60] flex items-end justify-center bg-ink-950/60 md:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('Carian suara', 'Voice search')}
        onClick={(e) => e.stopPropagation()}
        className="safe-bottom w-full max-w-md animate-slide-up rounded-t-3xl bg-white p-6 text-center shadow-float md:rounded-3xl dark:bg-ink-900"
      >
        <div className="flex justify-end">
          <button type="button" onClick={onClose} aria-label={t('Tutup', 'Close')} className="grid size-10 place-items-center rounded-full hover:bg-ink-100 dark:hover:bg-ink-800">
            <X className="size-5" />
          </button>
        </div>

        {phase.kind === 'listening' && (
          <>
            <button
              type="button"
              onClick={() => (listening ? speech.stop() : void run())}
              aria-label={listening ? t('Selesai bercakap', 'Done speaking') : t('Mula mendengar', 'Start listening')}
              className={cn('mx-auto grid size-28 place-items-center rounded-full bg-jade-500 text-white shadow-float', listening && 'animate-pulse')}
            >
              <Mic className="size-12" />
            </button>
            <p className="mt-5 text-xl font-bold">{t('Sebut destinasi anda', 'Say your destination')}</p>
            <p className="mt-1 min-h-7 text-lg text-ink-600 dark:text-ink-300" aria-live="polite">
              {speech.interim || t('cth. “Awana SkyWay” atau “bawa saya ke KLCC”', 'e.g. “Awana SkyWay” or “take me to KLCC”')}
            </p>
          </>
        )}

        {phase.kind === 'searching' && (
          <div className="py-6" aria-live="polite">
            <Loader2 className="mx-auto size-12 animate-spin text-jade-500" />
            <p className="mt-4 text-xl font-bold">{t('Mencari', 'Searching')} “{phase.query}”…</p>
          </div>
        )}

        {(phase.kind === 'notFound' || phase.kind === 'error') && (
          <div className="py-2" aria-live="assertive">
            <MicOff className="mx-auto size-12 text-ink-400" />
            <p className="mt-3 text-lg font-semibold">
              {phase.kind === 'notFound' ? t(`Tidak jumpa “${phase.query}”`, `Couldn’t find “${phase.query}”`) : errorText(phase.error)}
            </p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button type="button" onClick={() => void run()} className="flex items-center justify-center gap-2 rounded-2xl bg-jade-500 py-4 text-lg font-bold text-white">
                <RotateCcw className="size-5" /> {t('Cuba lagi', 'Try again')}
              </button>
              <button
                type="button"
                onClick={() => onTypeInstead(phase.kind === 'notFound' ? phase.query : '')}
                className="flex items-center justify-center gap-2 rounded-2xl bg-ink-100 py-4 text-lg font-semibold dark:bg-ink-800"
              >
                <Keyboard className="size-5" /> {t('Taip', 'Type')}
              </button>
            </div>
          </div>
        )}

        <p className="mt-5 text-[11px] text-ink-400">
          {t('Suara anda diproses oleh pelayar telefon (Google/Apple) untuk ditukar ke teks. JalanGo hanya terima teks.', 'Your voice is turned into text by your phone’s browser (Google/Apple). JalanGo only receives the text.')}
        </p>
      </div>
    </div>,
    document.body,
  );
}
