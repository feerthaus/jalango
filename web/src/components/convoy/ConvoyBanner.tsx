import { Users, X } from 'lucide-react';
import { useState } from 'react';
import { useConvoy } from '@/contexts/ConvoyContext';
import { memberStatus } from '@/utils/convoy';
import { ConvoySheet } from './ConvoySheet';

/** "Konvoi · 4 kereta" pill; tap to open the member panel. Also shows why we left a convoy. */
export function ConvoyBanner() {
  const { convoy, members, notice, dismissNotice } = useConvoy();
  const [open, setOpen] = useState(false);
  if (!convoy) {
    if (!notice) return null;
    return (
      <div role="status" className="pointer-events-auto flex items-center gap-2 rounded-full bg-ink-900/90 py-1.5 pl-3 pr-1.5 text-xs font-semibold text-white shadow-float">
        <Users className="size-4 shrink-0" />
        <span className="min-w-0 flex-1">{notice}</span>
        <button type="button" onClick={dismissNotice} aria-label="Dismiss" className="grid size-7 place-items-center rounded-full bg-white/15">
          <X className="size-3.5" />
        </button>
      </div>
    );
  }
  const offline = members.filter((m) => memberStatus(m) === 'offline').length;
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="pointer-events-auto flex max-w-full items-center gap-2 rounded-full bg-violet-600 py-1.5 pl-3 pr-3 text-xs font-semibold text-white shadow-float">
        <Users className="size-4 shrink-0" />
        <span className="flex -space-x-1">
          {members.slice(0, 6).map((m) => (
            <span key={m.user_id} className="size-3 rounded-full ring-2 ring-violet-600" style={{ background: m.color }} />
          ))}
        </span>
        <span className="min-w-0 truncate">
          Konvoi · {members.length} kereta{offline ? ` · ${offline} hilang isyarat` : ''}
        </span>
      </button>
      {open && <ConvoySheet onClose={() => setOpen(false)} />}
    </>
  );
}
