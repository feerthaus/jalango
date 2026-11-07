import { ListOrdered } from 'lucide-react';
import { useState } from 'react';
import { useItinerary } from '@/contexts/ItineraryContext';
import { ItinerarySheet } from './ItinerarySheet';

/** "Hentian 2/4 · seterusnya X" while an itinerary is in progress. */
export function ItineraryChip() {
  const { stops, activeIndex, nextIndex } = useItinerary();
  const [open, setOpen] = useState(false);
  if (stops.length === 0 || nextIndex === -1) return null;
  const doneCount = stops.filter((s) => s.done).length;
  const after = stops.find((s, i) => !s.done && i !== activeIndex);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="pointer-events-auto flex w-fit max-w-full items-center gap-2 rounded-full bg-violet-700 py-1.5 pl-3 pr-3 text-xs font-semibold text-white shadow-float">
        <ListOrdered className="size-4 shrink-0" />
        <span className="truncate">
          Hentian {Math.min(doneCount + 1, stops.length)}/{stops.length}
          {activeIndex !== -1 && after ? ` · seterusnya ${after.place.name}` : activeIndex === -1 ? ` · seterusnya ${stops[nextIndex].place.name}` : ' · hentian terakhir'}
        </span>
      </button>
      {open && <ItinerarySheet onClose={() => setOpen(false)} />}
    </>
  );
}
