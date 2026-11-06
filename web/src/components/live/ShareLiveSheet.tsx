import { Check, Copy, Loader2, MessageCircle, Radio, Share2, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { AuthForm } from '@/components/auth/AuthForm';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { useAuth } from '@/contexts/AuthContext';
import { useLiveShare } from '@/contexts/LiveShareContext';
import { useRouting } from '@/contexts/RoutingContext';
import { cn } from '@/lib/cn';
import { shareUrl, type LiveShare } from '@/services/liveShareService';

const DURATIONS = [
  { id: '15', label: '15 min', minutes: 15 },
  { id: '60', label: '1 hour', minutes: 60 },
  { id: '480', label: '8 hours', minutes: 480 },
] as const;

/** Create a private live-location link for friends & family. */
export function ShareLiveSheet({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const { available, start } = useLiveShare();
  const { status, destination } = useRouting();
  const navigating = status === 'navigating';
  const [name, setName] = useState(((user?.user_metadata?.name as string | undefined) || user?.email?.split('@')[0] || '').slice(0, 40));
  const [duration, setDuration] = useState<string>(navigating ? 'trip' : '60');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<LiveShare | null>(null);

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      const minutes = duration === 'trip' ? 720 : Number(duration);
      setCreated(await start({ displayName: name, minutes, untilArrival: duration === 'trip' }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start sharing');
    } finally {
      setBusy(false);
    }
  };

  if (!user) {
    return (
      <Sheet title="Share live location" onClose={onClose}>
        <p className="mb-3 text-sm text-ink-600 dark:text-ink-300">Sign in so the people you share with know it’s really you.</p>
        <AuthForm compact />
      </Sheet>
    );
  }
  if (!available) {
    return (
      <Sheet title="Share live location" onClose={onClose}>
        <p className="text-sm text-ink-500">Live sharing isn’t connected yet.</p>
      </Sheet>
    );
  }

  return (
    <Sheet title="Share live location" onClose={onClose}>
      {created ? <ShareLinkActions share={created} onDone={onClose} /> : (
        <div className="space-y-3">
          <p className="text-sm text-ink-600 dark:text-ink-300">
            Anyone with the link can see where you are{navigating && destination ? ` and your ETA to ${destination.name}` : ''} — no app needed.
          </p>
          <label className="block text-sm">
            <span className="font-medium">Your name on the link</span>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="e.g. Firdaus" className="mt-1 w-full rounded-xl bg-ink-100 px-3 py-2.5 text-base outline-none ring-jade-500 focus:ring-2 dark:bg-ink-800" />
          </label>
          <div role="radiogroup" aria-label="How long" className="grid grid-cols-2 gap-2">
            {navigating && <Choice id="trip" label="Until I arrive" current={duration} onPick={setDuration} />}
            {DURATIONS.map((d) => (
              <Choice key={d.id} id={d.id} label={d.label} current={duration} onPick={setDuration} />
            ))}
          </div>
          <p className="flex items-start gap-2 text-xs text-ink-500 dark:text-ink-400">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-jade-500" />
            Only your latest position is shared, never your history. Stop any time — the location is deleted straight away.
          </p>
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
          <Button className="w-full py-3" onClick={create} disabled={busy || !name.trim()}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Radio className="size-4" />} Start sharing
          </Button>
        </div>
      )}
    </Sheet>
  );
}

function Choice({ id, label, current, onPick }: { id: string; label: string; current: string; onPick: (id: string) => void }) {
  return (
    <button type="button" role="radio" aria-checked={current === id} onClick={() => onPick(id)} className={cn('rounded-xl py-2.5 text-sm font-semibold ring-2', current === id ? 'bg-jade-500/10 ring-jade-500' : 'bg-ink-100 ring-transparent dark:bg-ink-800')}>
      {label}
    </button>
  );
}

export function ShareLinkActions({ share, onDone }: { share: LiveShare; onDone?: () => void }) {
  const [copied, setCopied] = useState(false);
  const url = shareUrl(share.token);
  const text = `${share.display_name} is sharing their live location with you on JalanGo`;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };
  return (
    <div className="space-y-3">
      <p className="flex items-center gap-2 rounded-xl bg-jade-500/10 p-3 text-sm font-semibold text-jade-700 dark:text-jade-300">
        <Radio className="size-4 animate-pulse" /> You’re sharing your live location
      </p>
      <p className="break-all rounded-xl bg-ink-100 p-3 font-mono text-xs dark:bg-ink-800">{url}</p>
      <div className="grid grid-cols-3 gap-2">
        <a href={`https://wa.me/?text=${encodeURIComponent(`${text}: ${url}`)}`} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-1.5 rounded-xl bg-[#25D366] py-2.5 text-sm font-semibold text-white">
          <MessageCircle className="size-4" /> WhatsApp
        </a>
        <Button variant="secondary" onClick={copy}>
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />} {copied ? 'Copied' : 'Copy'}
        </Button>
        <Button variant="secondary" onClick={() => navigator.share?.({ title: 'JalanGo live location', text, url }).catch(() => {})} disabled={typeof navigator.share !== 'function'}>
          <Share2 className="size-4" /> More
        </Button>
      </div>
      {onDone && (
        <Button variant="ghost" className="w-full" onClick={onDone}>
          Done
        </Button>
      )}
    </div>
  );
}
