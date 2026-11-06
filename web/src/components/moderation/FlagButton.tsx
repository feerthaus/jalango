import { CheckCircle2, Flag, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { AuthForm } from '@/components/auth/AuthForm';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/cn';
import { FLAG_REASONS, flagContent, type FlagContentType, type FlagReason } from '@/services/moderationService';

/** Small "Report abuse" link + sheet, for reports, shortcuts and community places. */
export function FlagButton({ type, id, ownerId }: { type: FlagContentType; id: string; ownerId?: string | null }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  if (user && ownerId && user.id === ownerId) return null;
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1 text-[11px] font-medium text-ink-400 hover:text-red-500">
        <Flag className="size-3" /> Report abuse
      </button>
      {open && <FlagSheet type={type} id={id} onClose={() => setOpen(false)} signedIn={Boolean(user)} userId={user?.id} />}
    </>
  );
}

function FlagSheet({ type, id, onClose, signedIn, userId }: { type: FlagContentType; id: string; onClose: () => void; signedIn: boolean; userId?: string }) {
  const [reason, setReason] = useState<FlagReason | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const send = async () => {
    if (!reason || !userId) return;
    setBusy(true);
    setError(null);
    try {
      await flagContent(type, id, reason, note, userId);
      setDone(true);
      setTimeout(onClose, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet title="Report abuse" onClose={onClose}>
      {!signedIn ? (
        <AuthForm compact />
      ) : done ? (
        <div className="flex flex-col items-center py-4 text-center">
          <CheckCircle2 className="size-12 text-jade-500" />
          <p className="mt-2 font-semibold">Thanks — we’ll review it.</p>
          <p className="text-sm text-ink-500">Content reported by several people is hidden automatically.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <ul role="radiogroup" aria-label="Reason" className="space-y-1.5">
            {FLAG_REASONS.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={reason === r.id}
                  onClick={() => setReason(r.id)}
                  className={cn('flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm ring-2', reason === r.id ? 'bg-red-500/10 ring-red-500' : 'bg-ink-100 ring-transparent dark:bg-ink-800')}
                >
                  <span className="font-medium">{r.label}</span>
                  <span className="text-xs text-ink-400">{r.labelMs}</span>
                </button>
              </li>
            ))}
          </ul>
          <textarea
            rows={2}
            maxLength={280}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Details (optional)"
            aria-label="Details"
            className="w-full resize-none rounded-xl bg-ink-100 px-3 py-2 text-sm outline-none ring-jade-500 focus:ring-2 dark:bg-ink-800"
          />
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
          <Button variant="danger" className="w-full py-3" onClick={send} disabled={!reason || busy}>
            {busy && <Loader2 className="size-4 animate-spin" />} Send report
          </Button>
        </div>
      )}
    </Sheet>
  );
}
