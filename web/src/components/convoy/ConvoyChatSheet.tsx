import { Loader2, MapPin, Send } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Sheet } from '@/components/ui/Sheet';
import { useConvoy } from '@/contexts/ConvoyContext';
import { useConvoyChat } from '@/contexts/ConvoyChatContext';
import { useLocation } from '@/contexts/LocationContext';
import { useMapContext } from '@/contexts/MapContext';
import { cn } from '@/lib/cn';
import { useT } from '@/lib/i18n';
import { canType, QUICK, quickMeta, type QuickId } from '@/utils/convoyChat';
import { formatRelativeTime } from '@/utils/format';

const PASSENGER_KEY = 'jalango:convoy-passenger';

/**
 * Konvoi chat. While the car is moving the driver gets one-tap calls only
 * (typing comes back when stopped, or for a passenger who says so).
 */
export function ConvoyChatSheet({ onClose }: { onClose: () => void }) {
  const [t, lang] = useT();
  const { members, me, convoy } = useConvoy();
  const { messages, send, sendQuick, markRead } = useConvoyChat();
  const { fix } = useLocation();
  const { selectPlace } = useMapContext();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passenger, setPassenger] = useState(() => {
    try {
      return sessionStorage.getItem(PASSENGER_KEY) === '1';
    } catch {
      return false;
    }
  });
  const list = useRef<HTMLOListElement>(null);
  const typing = canType(fix?.speed, passenger);

  // Opening the chat (and new messages while it's open) count as read
  useEffect(() => {
    markRead();
    list.current?.scrollTo({ top: list.current.scrollHeight });
  }, [messages.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const fail = (e: unknown) => {
    const code = e instanceof Error ? e.message : '';
    setError(code === 'rate_limited' ? t('Perlahan sikit — terlalu banyak mesej.', 'Slow down — too many messages.') : code === 'inactive' ? t('Konvoi ini sudah tamat.', 'This convoy has ended.') : t('Tak dapat hantar. Cuba lagi.', 'Couldn’t send. Try again.'));
  };
  const quick = async (id: QuickId) => {
    setBusy(true);
    setError(null);
    try {
      await sendQuick(id);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };
  const submit = async () => {
    if (!text.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await send(text);
      setText('');
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };
  const togglePassenger = () => {
    setPassenger((p) => {
      try {
        sessionStorage.setItem(PASSENGER_KEY, p ? '0' : '1');
      } catch {
        /* ignore */
      }
      return !p;
    });
  };

  return (
    <Sheet title={t(`Chat · ${convoy?.name ?? 'Konvoi'}`, `Chat · ${convoy?.name ?? 'Convoy'}`)} onClose={onClose}>
      <div className="flex max-h-[70dvh] flex-col gap-3">
        <ol ref={list} aria-label={t('Mesej konvoi', 'Convoy messages')} className="min-h-24 flex-1 space-y-2 overflow-y-auto">
          {messages.length === 0 && <li className="py-6 text-center text-sm text-ink-500">{t('Belum ada mesej. Mesej dipadam bila konvoi tamat.', 'No messages yet. Messages are deleted when the convoy ends.')}</li>}
          {messages.map((m) => {
            const mine = m.user_id === me?.user_id;
            const who = members.find((x) => x.user_id === m.user_id);
            const q = quickMeta(m.quick);
            const located = m.latitude !== null && m.longitude !== null;
            return (
              <li key={m.id} className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
                <div className={cn('max-w-[85%] rounded-2xl px-3 py-2 text-sm', mine ? 'rounded-br-md bg-violet-600 text-white' : 'rounded-bl-md bg-ink-100 dark:bg-ink-800')}>
                  {!mine && (
                    <p className="mb-0.5 flex items-center gap-1 text-xs font-bold">
                      <span className="size-2.5 rounded-full" style={{ background: who?.color ?? '#888' }} />
                      {who?.display_name ?? t('Bekas ahli', 'Former member')}
                    </p>
                  )}
                  <p className={cn('whitespace-pre-wrap break-words', q && 'font-semibold')}>{q ? `${q.emoji} ${t(q.label)}` : m.body}</p>
                  <p className={cn('mt-0.5 flex items-center gap-2 text-[10px]', mine ? 'text-white/70' : 'text-ink-400')}>
                    {formatRelativeTime(m.created_at, lang)}
                    {located && (
                      <button
                        type="button"
                        onClick={() => {
                          selectPlace({ id: `convoy-msg:${m.id}`, name: `${q?.emoji ?? '📍'} ${who?.display_name ?? ''}`.trim(), address: q ? t(q.label) : '', coordinates: { lat: m.latitude!, lng: m.longitude! }, kind: 'address', source: 'jalango' });
                          onClose();
                        }}
                        className="inline-flex items-center gap-0.5 font-semibold underline"
                      >
                        <MapPin className="size-3" /> {t('Lihat di peta', 'Show on map')}
                      </button>
                    )}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>

        {/* One tap, safe while driving */}
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" aria-label={t('Mesej pantas', 'Quick messages')}>
          {QUICK.map((q) => (
            <button key={q.id} type="button" disabled={busy} onClick={() => void quick(q.id)} className="flex shrink-0 items-center gap-1.5 rounded-full bg-violet-600/10 px-3 py-2 text-sm font-semibold text-violet-800 ring-1 ring-violet-600/20 disabled:opacity-50 dark:text-violet-200">
              <span aria-hidden>{q.emoji}</span> {t(q.label)}
            </button>
          ))}
        </div>

        {typing ? (
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            <input
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, 300))}
              placeholder={t('Tulis mesej…', 'Write a message…')}
              aria-label={t('Mesej', 'Message')}
              className="min-w-0 flex-1 rounded-full bg-ink-100 px-4 py-2.5 text-base outline-none ring-violet-500 focus:ring-2 dark:bg-ink-800"
            />
            <button type="submit" disabled={busy || !text.trim()} aria-label={t('Hantar', 'Send')} className="grid size-11 shrink-0 place-items-center rounded-full bg-violet-600 text-white disabled:opacity-50">
              {busy ? <Loader2 className="size-5 animate-spin" /> : <Send className="size-5" />}
            </button>
          </form>
        ) : (
          <p className="rounded-xl bg-amber-400/15 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
            {t('Kenderaan sedang bergerak: guna butang pantas. Taip bila berhenti.', 'The car is moving: use the quick buttons. Type when you stop.')}
          </p>
        )}
        <div className="flex items-center justify-between gap-2 text-xs text-ink-500">
          <button type="button" role="switch" aria-checked={passenger} onClick={togglePassenger} className={cn('shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 font-semibold', passenger ? 'bg-violet-600 text-white' : 'bg-ink-100 dark:bg-ink-800')}>
            {passenger ? t('✓ Saya penumpang', '✓ I’m a passenger') : t('Saya penumpang', 'I’m a passenger')}
          </button>
          <span>{t('Hanya ahli konvoi nampak. Dipadam bila tamat.', 'Members only. Deleted when it ends.')}</span>
        </div>
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
      </div>
    </Sheet>
  );
}
