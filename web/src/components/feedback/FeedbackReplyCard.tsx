import { Check, MessageSquareReply, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { useAuth } from '@/contexts/AuthContext';
import { useT } from '@/lib/i18n';
import { feedbackCode, fetchMyReplies, markReplySeen, type FeedbackReply } from '@/services/feedbackReplyService';
import { formatRelativeTime } from '@/utils/format';

/** Check again when the app comes back to the front, at most this often */
const RECHECK_MS = 10 * 60_000;

/**
 * "JalanGo membalas maklum balas anda": when an admin has answered a message
 * this account or this phone sent, a card on the map screen (never while
 * navigating) opens the reply.
 */
export function FeedbackReplyCard() {
  const [t, lang] = useT();
  const { user } = useAuth();
  const [replies, setReplies] = useState<FeedbackReply[]>([]);
  const [open, setOpen] = useState<FeedbackReply | null>(null);
  const last = useRef(0);

  useEffect(() => {
    const check = () => {
      // Only people who could have a reply: signed in, or this phone sent feedback
      if (!user && !feedbackCode()) return;
      if (Date.now() - last.current < RECHECK_MS) return;
      last.current = Date.now();
      fetchMyReplies()
        .then((list) => setReplies(list.filter((r) => !r.reply_seen_at)))
        .catch(() => undefined);
    };
    last.current = 0;
    check();
    const onVisible = () => document.visibilityState === 'visible' && check();
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [user]);

  const done = (r: FeedbackReply) => {
    setReplies((l) => l.filter((x) => x.id !== r.id));
    setOpen(null);
    markReplySeen(r.id).catch(() => undefined);
  };

  const r = replies[0];
  return (
    <>
      {r && !open && (
        <div className="pointer-events-auto flex items-center gap-2 rounded-2xl bg-white p-3 shadow-float ring-1 ring-ink-900/5 dark:bg-ink-800 dark:ring-white/10">
          <button type="button" onClick={() => setOpen(r)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-jade-500 text-ink-950">
              <MessageSquareReply className="size-5" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-bold">{t('JalanGo membalas maklum balas anda', 'JalanGo replied to your feedback')}</span>
              <span className="block truncate text-xs text-ink-500">{r.reply}</span>
            </span>
          </button>
          <button type="button" onClick={() => done(r)} aria-label={t('Tutup', 'Close')} className="grid size-8 shrink-0 place-items-center rounded-full text-ink-400 hover:bg-ink-100 dark:hover:bg-ink-700">
            <X className="size-4" />
          </button>
        </div>
      )}
      {open && (
        <Sheet title={t('Balasan JalanGo', 'Reply from JalanGo')} onClose={() => done(open)}>
          <div className="space-y-3">
            <div className="rounded-2xl bg-ink-100 p-3 text-sm dark:bg-ink-800">
              <p className="mb-1 text-xs font-semibold text-ink-500">
                {t('Mesej anda', 'Your message')} · {formatRelativeTime(open.created_at, lang)}
              </p>
              <p className="whitespace-pre-wrap text-ink-700 dark:text-ink-200">{open.message}</p>
            </div>
            <div className="rounded-2xl bg-jade-500/10 p-3 text-sm ring-1 ring-jade-500/30">
              <p className="mb-1 flex items-center gap-1 text-xs font-semibold text-jade-700 dark:text-jade-300">
                <MessageSquareReply className="size-3.5" /> {t('Pasukan JalanGo', 'The JalanGo team')} · {formatRelativeTime(open.replied_at, lang)}
              </p>
              <p className="whitespace-pre-wrap">{open.reply}</p>
            </div>
            <p className="text-xs text-ink-500">{t('Ada lagi nak dikongsi? Hantar maklum balas baharu dari Profil.', 'Anything else? Send new feedback from your Profile.')}</p>
            <Button className="w-full py-3" onClick={() => done(open)}>
              <Check className="size-4" /> {t('Terima kasih', 'Thanks')}
            </Button>
          </div>
        </Sheet>
      )}
    </>
  );
}
