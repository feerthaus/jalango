import type { ReactNode } from 'react';
import { DemoBadge } from '@/components/ui/DemoBadge';
import { cn } from '@/lib/cn';
import type { Place } from '@/types';
import { formatDistance } from '@/utils/geo';
import { placeIcon } from './placeIcon';

interface PlaceRowProps {
  place: Place;
  onSelect: (place: Place) => void;
  active?: boolean;
  leadingIcon?: ReactNode;
  trailing?: ReactNode;
  id?: string;
}

export function PlaceRow({ place, onSelect, active, leadingIcon, trailing, id }: PlaceRowProps) {
  const Icon = placeIcon(place);
  return (
    <li id={id} role="option" aria-selected={active} className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => onSelect(place)}
        className={cn(
          'flex min-w-0 flex-1 items-center gap-3 rounded-xl px-2 py-2.5 text-left transition',
          active ? 'bg-jade-500/10' : 'hover:bg-ink-100 dark:hover:bg-ink-800',
        )}
      >
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-ink-200">
          {leadingIcon ?? <Icon className="size-5" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate font-medium">{place.name}</span>
            {place.source === 'demo' && <DemoBadge label="Sample" className="shrink-0" />}
          </span>
          <span className="block truncate text-sm text-ink-500 dark:text-ink-300">{place.address || place.category || '—'}</span>
        </span>
        {place.distanceMeters !== undefined && (
          <span className="shrink-0 text-xs font-medium tabular-nums text-ink-500 dark:text-ink-300">{formatDistance(place.distanceMeters)}</span>
        )}
      </button>
      {trailing}
    </li>
  );
}
