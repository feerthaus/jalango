import { Loader2, Navigation, Send, Sparkles } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { AuthForm } from '@/components/auth/AuthForm';
import { Sheet } from '@/components/ui/Sheet';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation } from '@/contexts/LocationContext';
import { useRouting } from '@/contexts/RoutingContext';
import { cn } from '@/lib/cn';
import { useT } from '@/lib/i18n';
import { ApiError } from '@/services/apiClient';
import { askAssistant, type AssistantPlace, type ChatTurn } from '@/services/assistantService';
import type { Place } from '@/types';

interface Msg extends ChatTurn {
  places?: AssistantPlace[];
}

const EXAMPLES = [
  { ms: 'Esok pukul 7 pagi ke KLIA, cara paling murah?', en: 'Tomorrow 7am to KLIA, cheapest way?' },
  { ms: 'Ke KLCC: memandu atau naik LRT, mana lebih baik?', en: 'To KLCC: drive or take the LRT?' },
  { ms: 'Dari KL Sentral ke Ipoh hari Sabtu, ada ETS pukul berapa?', en: 'KL Sentral to Ipoh on Saturday: ETS times?' },
];

const toPlace = (p: AssistantPlace): Place => ({
  id: p.id,
  name: p.name,
  address: p.address,
  coordinates: { lat: p.lat, lng: p.lng },
  kind: 'poi',
  source: p.id.startsWith('jalango:') ? 'jalango' : 'mapbox',
});

/**
 * "Pembantu perjalanan": ask about a trip in plain words; Claude answers with
 * JalanGo's own search, public transport planner and driving estimates, and
 * places it mentions get a "Arah" button. Signed-in only (daily limit).
 */
export function AssistantSheet({ initial = '', onClose, onRoute }: { initial?: string; onClose: () => void; onRoute?: () => void }) {
  const [t, lang] = useT();
  const { user } = useAuth();
  const { fix } = useLocation();
  const { planRoute } = useRouting();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const end = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }, [msgs, busy]);

  const send = async (q: string) => {
    const question = q.trim().slice(0, 600);
    if (!question || busy) return;
    const history: Msg[] = [...msgs, { role: 'user', text: question }];
    setMsgs(history);
    setText('');
    setBusy(true);
    setError(null);
    try {
      const a = await askAssistant(history, fix?.coordinates ?? null, lang);
      setMsgs([...history, { role: 'assistant', text: a.reply, places: a.places }]);
      setRemaining(a.remaining);
    } catch (e) {
      const code = e instanceof ApiError ? e.code : '';
      setError(
        code === 'daily_limit'
          ? t('Had soalan hari ini sudah habis. Cuba lagi esok.', 'You’ve used today’s questions. Try again tomorrow.')
          : code === 'unauthorized'
            ? t('Sila log masuk semula.', 'Please sign in again.')
            : t('Pembantu tak dapat menjawab sekarang. Cuba sebentar lagi.', 'The assistant can’t answer right now. Try again shortly.'),
      );
      // keep the question in the box so it can be sent again
      setMsgs(msgs);
      setText(question);
    } finally {
      setBusy(false);
    }
  };

  const title = t('Pembantu perjalanan (AI)', 'Trip assistant (AI)');
  if (!user) {
    return (
      <Sheet title={title} onClose={onClose}>
        <p className="mb-3 text-sm text-ink-600 dark:text-ink-300">
          {t('Tanya cara terbaik ke mana-mana dalam bahasa biasa: memandu, LRT/MRT, KTM, bas atau Grab, dengan masa dan kos. Log masuk untuk guna (percuma, 20 soalan sehari).', 'Ask the best way anywhere in plain words: driving, LRT/MRT, KTM, bus or Grab, with times and costs. Sign in to use it (free, 20 questions a day).')}
        </p>
        <AuthForm compact />
      </Sheet>
    );
  }

  return (
    <Sheet title={title} onClose={onClose}>
      <div className="space-y-3">
        {msgs.length === 0 && (
          <div className="space-y-2">
            <p className="text-sm text-ink-600 dark:text-ink-300">{t('Tanya tentang perjalanan anda. Saya semak jadual tren, trafik dan kos untuk anda.', 'Ask about your trip. I’ll check train times, traffic and costs for you.')}</p>
            {EXAMPLES.map((e) => (
              <button key={e.en} type="button" onClick={() => void send(t(e.ms, e.en))} className="block w-full rounded-xl bg-ink-100 px-3 py-2 text-left text-sm hover:bg-ink-200 dark:bg-ink-800 dark:hover:bg-ink-700">
                {t(e.ms, e.en)}
              </button>
            ))}
          </div>
        )}

        <ol aria-label={t('Perbualan', 'Conversation')} aria-live="polite" className="space-y-2">
          {msgs.map((m, i) => (
            <li key={i} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
              <div className={cn('max-w-[88%] whitespace-pre-line rounded-2xl px-3 py-2 text-sm', m.role === 'user' ? 'bg-jade-500 text-ink-950' : 'bg-ink-100 text-ink-900 dark:bg-ink-800 dark:text-ink-100')}>
                {m.text}
                {m.places && m.places.length > 0 && (
                  <span className="mt-2 flex flex-wrap gap-1.5">
                    {m.places.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          planRoute(toPlace(p));
                          onRoute?.();
                          onClose();
                        }}
                        className="flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-ink-900 shadow-sm dark:bg-ink-900 dark:text-white"
                      >
                        <Navigation className="size-3.5 text-jade-600" /> {t(`Arah ke ${p.name}`, `Directions to ${p.name}`)}
                      </button>
                    ))}
                  </span>
                )}
              </div>
            </li>
          ))}
          {busy && (
            <li className="flex items-center gap-2 text-sm text-ink-500">
              <Loader2 className="size-4 animate-spin" /> {t('Sedang semak jadual, trafik dan kos…', 'Checking timetables, traffic and costs…')}
            </li>
          )}
        </ol>
        <div ref={end} />

        {error && (
          <p role="alert" className="rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
            {error}
          </p>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send(text);
          }}
          className="flex items-end gap-2"
        >
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void send(text);
              }
            }}
            rows={2}
            maxLength={600}
            placeholder={t('Cth: Esok 8 pagi dari Bangsar ke Putrajaya, bawa 2 beg', 'E.g. Tomorrow 8am from Bangsar to Putrajaya, 2 big bags')}
            aria-label={t('Soalan anda', 'Your question')}
            className="min-h-[3rem] flex-1 resize-none rounded-xl bg-ink-100 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-jade-500 dark:bg-ink-800"
          />
          <button type="submit" disabled={busy || !text.trim()} aria-label={t('Hantar', 'Send')} className="grid size-11 place-items-center rounded-xl bg-jade-500 text-ink-950 disabled:opacity-40">
            <Send className="size-5" />
          </button>
        </form>
        <p className="flex items-start gap-1.5 text-[11px] leading-snug text-ink-400">
          <Sparkles className="mt-0.5 size-3 shrink-0" />
          <span>
            {t('Jawapan AI (Claude) guna jadual, trafik dan harga JalanGo, tapi boleh tersilap. Semak masa dan tambang sebelum bertolak. Soalan dan lokasi anggaran anda dihantar ke Anthropic untuk diproses; tidak disimpan oleh JalanGo.', 'AI answers (Claude) use JalanGo’s timetables, traffic and prices, but can be wrong. Check times and fares before you go. Your question and approximate location are sent to Anthropic to process; JalanGo doesn’t keep them.')}
            {remaining !== null && ` ${t(`${remaining} soalan lagi hari ini.`, `${remaining} questions left today.`)}`}
          </span>
        </p>
      </div>
    </Sheet>
  );
}
