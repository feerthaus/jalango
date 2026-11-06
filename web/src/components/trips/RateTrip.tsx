import { Check, Star } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { useTrips } from '@/contexts/TripsContext';
import { cn } from '@/lib/cn';
import type { Trip, TripTag } from '@/types';

export const TRIP_TAGS: { id: TripTag; label: string; good: boolean }[] = [
  { id: 'fast_route', label: 'Fast route', good: true },
  { id: 'accurate_directions', label: 'Clear directions', good: true },
  { id: 'good_shortcut', label: 'Good shortcut', good: true },
  { id: 'toll_worth_it', label: 'Toll worth it', good: true },
  { id: 'heavy_traffic', label: 'Heavy traffic', good: false },
  { id: 'wrong_directions', label: 'Wrong directions', good: false },
];

/** 1–5 stars + quick tags + optional comment for a finished trip. */
export function RateTrip({ trip, onDone, compact = false }: { trip: Trip; onDone?: () => void; compact?: boolean }) {
  const { rateTrip } = useTrips();
  const [stars, setStars] = useState(trip.rating ?? 0);
  const [hover, setHover] = useState(0);
  const [tags, setTags] = useState<TripTag[]>(trip.ratingTags ?? []);
  const [comment, setComment] = useState(trip.ratingComment ?? '');
  const [saved, setSaved] = useState(false);

  const toggle = (t: TripTag) => setTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  const save = () => {
    if (!stars) return;
    rateTrip(trip.id, stars, tags, comment);
    setSaved(true);
    setTimeout(() => onDone?.(), 900);
  };

  if (saved) {
    return (
      <p className="flex items-center justify-center gap-2 py-2 text-sm font-semibold text-jade-600 dark:text-jade-400">
        <Check className="size-4" /> Thanks for rating your trip!
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-center gap-1" role="radiogroup" aria-label="Rate this trip" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={stars === n}
            aria-label={`${n} star${n > 1 ? 's' : ''}`}
            onClick={() => setStars(n)}
            onMouseEnter={() => setHover(n)}
            className="p-1 transition active:scale-90"
          >
            <Star className={cn('size-9', (hover || stars) >= n ? 'text-amber-400' : 'text-ink-300 dark:text-ink-600')} fill={(hover || stars) >= n ? 'currentColor' : 'none'} />
          </button>
        ))}
      </div>
      {stars > 0 && (
        <>
          <div className="flex flex-wrap justify-center gap-2">
            {TRIP_TAGS.filter((t) => (stars >= 4 ? t.good : stars <= 2 ? !t.good : true)).map((t) => (
              <button
                key={t.id}
                type="button"
                aria-pressed={tags.includes(t.id)}
                onClick={() => toggle(t.id)}
                className={cn(
                  'rounded-full px-3 py-1.5 text-xs font-semibold transition',
                  tags.includes(t.id) ? 'bg-jade-500 text-ink-950' : 'bg-ink-100 text-ink-700 dark:bg-ink-800 dark:text-ink-200',
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
          {!compact && (
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value.slice(0, 500))}
              rows={2}
              placeholder="Anything else? (optional)"
              className="w-full resize-none rounded-xl bg-ink-100 px-3 py-2 text-sm outline-none ring-jade-500 focus:ring-2 dark:bg-ink-800"
            />
          )}
          <Button className="w-full" onClick={save}>
            Save rating
          </Button>
        </>
      )}
    </div>
  );
}
