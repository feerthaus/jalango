import { MessageCircle, Users, X } from 'lucide-react';
import { useState } from 'react';
import { useConvoy } from '@/contexts/ConvoyContext';
import { memberStatus } from '@/utils/convoy';
import { ConvoySheet } from './ConvoySheet';
import { ConvoyChatSheet } from './ConvoyChatSheet';
import { useConvoyChat } from '@/contexts/ConvoyChatContext';
import { quickMeta } from '@/utils/convoyChat';
import { useT } from '@/lib/i18n';

/** "Konvoi · 4 kereta" pill (tap: members), the chat button with unread count, and a short banner for each new message. Also shows why we left a convoy. */
export function ConvoyBanner() {
  const [t] = useT();
  const { convoy, members, notice, dismissNotice } = useConvoy();
  const { unread, incoming, dismissIncoming } = useConvoyChat();
  const [open, setOpen] = useState(false);
  const [chat, setChat] = useState(false);
  if (!convoy) {
    if (!notice) return null;
    return (
      <div role="status" className="pointer-events-auto flex items-center gap-2 rounded-full bg-ink-900/90 py-1.5 pl-3 pr-1.5 text-xs font-semibold text-white shadow-float">
        <Users className="size-4 shrink-0" />
        <span className="min-w-0 flex-1">{notice}</span>
        <button type="button" onClick={dismissNotice} aria-label={t('Tutup', 'Dismiss')} className="grid size-7 place-items-center rounded-full bg-white/15">
          <X className="size-3.5" />
        </button>
      </div>
    );
  }
  const offline = members.filter((m) => memberStatus(m) === 'offline').length;
  const from = incoming ? members.find((m) => m.user_id === incoming.user_id) : null;
  const q = quickMeta(incoming?.quick);
  return (
    <>
      <div className="flex max-w-full items-center gap-1.5">
        <button type="button" onClick={() => setOpen(true)} className="pointer-events-auto flex min-w-0 items-center gap-2 rounded-full bg-violet-600 py-1.5 pl-3 pr-3 text-xs font-semibold text-white shadow-float">
          <Users className="size-4 shrink-0" />
          <span className="flex -space-x-1">
            {members.slice(0, 6).map((m) => (
              <span key={m.user_id} className="size-3 rounded-full ring-2 ring-violet-600" style={{ background: m.color }} />
            ))}
          </span>
          <span className="min-w-0 truncate">
            {t('Konvoi ·', 'Convoy ·')} {members.length} {t('kereta', 'car')}{offline ? t(` · ${offline} hilang isyarat`, ` · ${offline} lost signal`) : ''}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setChat(true)}
          aria-label={unread ? t(`Chat konvoi, ${unread} mesej baharu`, `Convoy chat, ${unread} new`) : t('Chat konvoi', 'Convoy chat')}
          className="pointer-events-auto relative grid size-8 shrink-0 place-items-center rounded-full bg-violet-600 text-white shadow-float"
        >
          <MessageCircle className="size-4" />
          {unread > 0 && <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-red-600 px-1 text-center text-[10px] font-bold leading-4">{unread > 9 ? '9+' : unread}</span>}
        </button>
      </div>
      {incoming && !chat && (
        <button
          type="button"
          onClick={() => {
            dismissIncoming();
            setChat(true);
          }}
          className="pointer-events-auto mt-1.5 flex max-w-full items-center gap-2 rounded-2xl bg-ink-950/95 px-3 py-2 text-left text-sm text-white shadow-float"
        >
          <span className="size-3 shrink-0 rounded-full" style={{ background: from?.color ?? '#888' }} />
          <span className="min-w-0 truncate">
            <strong>{from?.display_name ?? '…'}:</strong> {q ? `${q.emoji} ${t(q.label)}` : incoming.body}
          </span>
        </button>
      )}
      {open && <ConvoySheet onClose={() => setOpen(false)} />}
      {chat && <ConvoyChatSheet onClose={() => setChat(false)} />}
    </>
  );
}
