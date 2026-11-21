import { Bug, CheckCircle2, Lightbulb, Loader2, Map as MapIcon, MessageSquare } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/cn';
import { sendFeedback } from '@/services/accountService';
import { useT } from '@/lib/i18n';

const CATEGORIES = [
  { id: 'bug', label: 'Problem', labelMs: 'Masalah', icon: Bug },
  { id: 'idea', label: 'Idea', labelMs: 'Cadangan', icon: Lightbulb },
  { id: 'map_data', label: 'Map / route', labelMs: 'Peta / laluan', icon: MapIcon },
  { id: 'other', label: 'Other', labelMs: 'Lain-lain', icon: MessageSquare },
] as const;

export function FeedbackSheet({ onClose }: { onClose: () => void }) {
  const [t] = useT();
  const { user } = useAuth();
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]['id']>('bug');
  const [message, setMessage] = useState('');
  const [contact, setContact] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      await sendFeedback({ category, message, contact: contact || undefined, page: window.location.pathname });
      setDone(true);
      setTimeout(onClose, 1800);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send feedback');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet title={t('Hantar maklum balas', 'Send feedback')} onClose={onClose}>
      {done ? (
        <div className="flex flex-col items-center py-4 text-center">
          <CheckCircle2 className="size-12 text-jade-500" />
          <p className="mt-2 font-semibold">{t('Terima kasih! Maklum balas anda membantu JalanGo jadi lebih baik.', 'Terima kasih! Your feedback helps make JalanGo better.')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          <div role="radiogroup" aria-label={t('Jenis', 'Type')} className="grid grid-cols-4 gap-2">
            {CATEGORIES.map(({ id, label, labelMs, icon: Icon }) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={category === id}
                onClick={() => setCategory(id)}
                className={cn('flex flex-col items-center gap-1 rounded-xl p-2 text-[11px] font-semibold ring-2', category === id ? 'bg-jade-500/10 ring-jade-500' : 'bg-ink-100 ring-transparent dark:bg-ink-800')}
              >
                <Icon className="size-5" />
                {label}
                <span className="-mt-1 text-[10px] font-normal text-ink-400">{labelMs}</span>
              </button>
            ))}
          </div>
          <textarea
            rows={4}
            maxLength={2000}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={category === 'map_data' ? t('cth. Jalan ni dah ditutup, tapi app masih suruh lalu', 'e.g. Jalan ni dah ditutup, tapi app masih suruh lalu') : t('Beritahu apa yang berlaku atau apa yang anda mahu…', 'Tell us what happened or what you’d like…')}
            aria-label={t('Mesej', 'Message')}
            className="w-full resize-none rounded-xl bg-ink-100 px-3 py-2 text-base outline-none ring-jade-500 focus:ring-2 dark:bg-ink-800"
          />
          {!user && (
            <input
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              maxLength={120}
              placeholder={t('Emel atau telefon (pilihan)', 'Email or phone (optional)')}
              aria-label={t('Hubungan', 'Contact')}
              className="w-full rounded-xl bg-ink-100 px-3 py-2.5 text-base outline-none ring-jade-500 focus:ring-2 dark:bg-ink-800"
            />
          )}
          <p className="text-xs text-ink-500">{t('Balasan pasukan JalanGo akan muncul dalam app ini.', 'Replies from the JalanGo team show up in this app.')}</p>
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
          <Button className="w-full py-3" onClick={send} disabled={busy || message.trim().length < 3}>
            {busy && <Loader2 className="size-4 animate-spin" />} {t('Hantar', 'Send')}
          </Button>
        </div>
      )}
    </Sheet>
  );
}
