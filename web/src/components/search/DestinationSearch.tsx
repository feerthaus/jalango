import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useMapContext } from '@/contexts/MapContext';
import { useSavedPlaces } from '@/contexts/SavedPlacesContext';
import { usePlaceSearch } from '@/hooks/usePlaceSearch';
import { cn } from '@/lib/cn';
import type { Place } from '@/types';
import { VoiceSearchButton } from '@/components/voice/VoiceSearch';
import { SearchBar } from './SearchBar';
import { optionId, SearchPanel } from './SearchPanel';

/** Search bar + autocomplete panel. Selecting a result shows it on the map. */
export function DestinationSearch({ onOpenChange }: { onOpenChange?: (open: boolean) => void }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const search = usePlaceSearch(query);
  const { selectPlace } = useMapContext();
  const { addRecent } = useSavedPlaces();

  useEffect(() => onOpenChange?.(open), [open, onOpenChange]);
  useEffect(() => setActiveIndex(-1), [search.results]);

  // Close when clicking outside (desktop dropdown)
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    return () => document.removeEventListener('pointerdown', onPointer);
  }, [open]);

  const close = () => {
    setOpen(false);
    inputRef.current?.blur();
  };

  const choose = (place: Place) => {
    selectPlace(place);
    addRecent(place);
    setQuery('');
    close();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    const n = search.results.length;
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    } else if (e.key === 'ArrowDown' && n) {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % n);
    } else if (e.key === 'ArrowUp' && n) {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? n - 1 : i - 1));
    } else if (e.key === 'Enter' && n) {
      e.preventDefault();
      choose(search.results[Math.max(0, activeIndex)]);
    }
  };

  return (
    <div ref={rootRef} className={cn('relative', open && 'max-md:fixed max-md:inset-0 max-md:z-40 max-md:bg-ink-50/95 max-md:p-3 max-md:pt-[calc(env(safe-area-inset-top)+0.75rem)] max-md:backdrop-blur-sm max-md:dark:bg-ink-950/95')}>
      <SearchBar
        ref={inputRef}
        value={query}
        onChange={(v) => {
          setQuery(v);
          setOpen(true);
        }}
        open={open}
        onOpen={() => setOpen(true)}
        onClose={close}
        onKeyDown={onKeyDown}
        loading={search.loading}
        activeDescendant={activeIndex >= 0 ? optionId(activeIndex) : undefined}
        extra={
          <VoiceSearchButton
            onTypeInstead={(text) => {
              setQuery(text);
              setOpen(true);
              setTimeout(() => inputRef.current?.focus(), 50);
            }}
          />
        }
      />
      {open && <SearchPanel query={query} search={search} activeIndex={activeIndex} onSelect={choose} />}
    </div>
  );
}
