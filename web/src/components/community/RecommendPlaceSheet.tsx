import { CheckCircle2, Loader2, MapPin, X } from 'lucide-react';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { AuthForm } from '@/components/auth/AuthForm';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/contexts/AuthContext';
import { useCommunityPlaces } from '@/contexts/CommunityPlacesContext';
import { COMMUNITY_CATEGORIES } from '@/lib/communityCategories';
import { cn } from '@/lib/cn';
import type { CommunityCategory, Coordinates } from '@/types';
import { isInMalaysia } from '@/utils/geo';

/** Share a favourite food spot / attraction with other JalanGo users. */
export function RecommendPlaceSheet({
  initial,
  onClose,
}: {
  initial: { name: string; address: string; coordinates: Coordinates; category?: CommunityCategory };
  onClose: () => void;
}) {
  const { user } = useAuth();
  const { available, add } = useCommunityPlaces();
  const [name, setName] = useState(initial.name);
  const [category, setCategory] = useState<CommunityCategory | null>(initial.category ?? null);
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const outside = !isInMalaysia(initial.coordinates);

  const submit = async () => {
    if (!category) return;
    setBusy(true);
    setError(null);
    try {
      await add({ name, category, description, address: initial.address, latitude: initial.coordinates.lat, longitude: initial.coordinates.lng });
      setDone(true);
      setTimeout(onClose, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not share this place');
    } finally {
      setBusy(false);
    }
  };

  const input = 'w-full rounded-xl bg-ink-100 px-3 py-2.5 text-base outline-none ring-jade-500 focus:ring-2 dark:bg-ink-800';
  let body: React.ReactNode;
  if (!available) body = <p className="text-sm text-ink-500">Community features aren’t connected yet.</p>;
  else if (!user) body = <AuthForm compact />;
  else if (done)
    body = (
      <div className="flex flex-col items-center py-4 text-center">
        <CheckCircle2 className="size-12 text-jade-500" />
        <p className="mt-2 font-semibold">Shared! Other drivers can find it in Explore.</p>
      </div>
    );
  else
    body = (
      <div className="space-y-3">
        <p className="flex items-center gap-2 rounded-xl bg-ink-100 p-3 text-sm dark:bg-ink-800">
          <MapPin className="size-4 shrink-0 text-jade-500" />
          <span className="truncate">{initial.address || 'At this location'}</span>
        </p>
        <input className={input} placeholder="Place name" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} aria-label="Place name" />
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Category">
          {COMMUNITY_CATEGORIES.map(({ id, label, labelMs, icon: Icon }) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={category === id}
              onClick={() => setCategory(id)}
              className={cn('flex flex-col items-center gap-1 rounded-xl p-2 text-xs font-semibold ring-2 transition', category === id ? 'bg-jade-500/10 ring-jade-500' : 'bg-ink-100 ring-transparent dark:bg-ink-800')}
            >
              <Icon className="size-5" />
              {label}
              <span className="-mt-1 text-[10px] font-normal text-ink-400">{labelMs}</span>
            </button>
          ))}
        </div>
        <textarea
          className={`${input} resize-none`}
          rows={3}
          maxLength={280}
          placeholder="Why is it the best? e.g. Nasi lemak sambal sotong, buka pukul 7 pagi"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          aria-label="Why it's great"
        />
        {outside && <p className="text-xs text-red-600">Only places in Malaysia can be shared.</p>}
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        <Button className="w-full py-3" onClick={submit} disabled={busy || !category || name.trim().length < 2 || outside}>
          {busy && <Loader2 className="size-4 animate-spin" />} Share this place
        </Button>
        <p className="text-center text-[11px] text-ink-400">Share real places you’ve been to. Ads and spam will be removed.</p>
      </div>
    );

  return createPortal(
    <div className="pointer-events-auto fixed inset-0 z-50 flex items-end justify-center bg-ink-950/50 md:items-center" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="rec-title" onClick={(e) => e.stopPropagation()} className="safe-bottom max-h-[90dvh] w-full max-w-md animate-slide-up overflow-y-auto rounded-t-3xl bg-white p-5 shadow-float md:rounded-3xl dark:bg-ink-900">
        <div className="mb-4 flex items-center justify-between">
          <h2 id="rec-title" className="text-xl font-bold">Recommend a place</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="grid size-9 place-items-center rounded-full hover:bg-ink-100 dark:hover:bg-ink-800">
            <X className="size-5" />
          </button>
        </div>
        {body}
      </div>
    </div>,
    document.body,
  );
}
