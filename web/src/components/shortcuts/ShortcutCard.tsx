import { Loader2, Navigation, ThumbsDown, ThumbsUp, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/contexts/AuthContext';
import { useRouting } from '@/contexts/RoutingContext';
import { useShortcuts } from '@/contexts/ShortcutsContext';
import { cn } from '@/lib/cn';
import type { Shortcut } from '@/types';
import { formatRelativeTime } from '@/utils/format';
import { formatDistance } from '@/utils/geo';

export function ShortcutCard({ shortcut, onClose }: { shortcut: Shortcut; onClose: () => void }) {
  const { user } = useAuth();
  const { vote, remove, myVotes } = useShortcuts();
  const { applyShortcut, destination } = useRouting();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mine = user?.id === shortcut.user_id;
  const myVote = myVotes[shortcut.id];

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(null);
    }
  };

  return (
    <article aria-label={`Shortcut: ${shortcut.title}`} className="glass pointer-events-auto animate-slide-up rounded-3xl p-4 shadow-float ring-1 ring-ink-900/5 dark:ring-white/10">
      <div className="flex items-start gap-3">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-violet-500 text-white">
          <Navigation className="size-6" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-violet-500">Community shortcut</p>
          <h2 className="text-lg font-bold leading-tight">{shortcut.title}</h2>
          <p className="mt-0.5 text-xs text-ink-500 dark:text-ink-400">
            {formatDistance(shortcut.distance_m)}
            {shortcut.avoids && ` · avoids ${shortcut.avoids}`} · shared {formatRelativeTime(shortcut.created_at)}
          </p>
          {shortcut.description && <p className="mt-2 text-sm">{shortcut.description}</p>}
        </div>
        <button type="button" onClick={onClose} aria-label="Close" className="-mr-1 -mt-1 grid size-9 place-items-center rounded-full text-ink-500 hover:bg-ink-100 dark:hover:bg-ink-800">
          <X className="size-5" />
        </button>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <VoteButton active={myVote === 1} disabled={mine || !user || busy !== null} onClick={() => run('up', () => vote(shortcut.id, 1))} label={`Useful (${shortcut.upvotes})`}>
          <ThumbsUp className="size-4" /> {shortcut.upvotes}
        </VoteButton>
        <VoteButton active={myVote === -1} disabled={mine || !user || busy !== null} onClick={() => run('down', () => vote(shortcut.id, -1))} label={`Not useful (${shortcut.downvotes})`}>
          <ThumbsDown className="size-4" /> {shortcut.downvotes}
        </VoteButton>
        {mine && (
          <Button variant="danger" className="ml-auto px-3 py-2 text-xs" onClick={() => run('del', async () => { await remove(shortcut.id); onClose(); })}>
            {busy === 'del' ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />} Delete
          </Button>
        )}
      </div>
      {!user && <p className="mt-1 text-xs text-ink-400">Sign in to rate shortcuts.</p>}
      {error && <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}

      <Button className="mt-3 w-full py-3" onClick={() => { applyShortcut(shortcut, destination); onClose(); }}>
        <Navigation className="size-5" /> {destination ? `Use on my trip to ${destination.name}` : 'Drive this shortcut'}
      </Button>
      <p className="mt-2 text-[11px] text-ink-400">Shared by a JalanGo driver. Check road signs — conditions may change.</p>
    </article>
  );
}

function VoteButton({ active, disabled, onClick, label, children }: { active: boolean; disabled: boolean; onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      aria-label={label}
      className={cn('flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold transition disabled:opacity-60', active ? 'bg-violet-500 text-white' : 'bg-ink-100 dark:bg-ink-800')}
    >
      {children}
    </button>
  );
}
