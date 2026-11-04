import { AlertTriangle, Clock, SearchX, Star, Trash2, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { PlaceRow } from '@/components/places/PlaceRow';
import { DemoBadge } from '@/components/ui/DemoBadge';
import { DEMO_PLACES } from '@/data/demoPlaces';
import { useSavedPlaces } from '@/contexts/SavedPlacesContext';
import type { PlaceSearchState } from '@/hooks/usePlaceSearch';
import type { Place } from '@/types';

const QUICK_CITIES = ['demo:kl', 'demo:johor-bahru', 'demo:george-town', 'demo:ipoh', 'demo:melaka', 'demo:kota-kinabalu', 'demo:kuching']
  .map((id) => DEMO_PLACES.find((p) => p.id === id))
  .filter((p): p is Place => Boolean(p));

interface SearchPanelProps {
  query: string;
  search: PlaceSearchState;
  activeIndex: number;
  onSelect: (place: Place) => void;
}

export function optionId(index: number) {
  return `search-option-${index}`;
}

export function SearchPanel({ query, search, activeIndex, onSelect }: SearchPanelProps) {
  const { recents, favourites, removeRecent, clearRecents } = useSavedPlaces();
  const typing = query.trim().length >= 2;

  return (
    <div
      id="search-results"
      className="pointer-events-auto mt-2 max-h-[calc(100dvh-10rem)] overflow-y-auto overscroll-contain rounded-2xl bg-white p-2 shadow-float ring-1 ring-ink-900/5 md:max-h-[70vh] dark:bg-ink-900 dark:ring-white/10"
    >
      {typing ? (
        <Results search={search} activeIndex={activeIndex} onSelect={onSelect} pending={search.query !== query.trim()} />
      ) : (
        <>
          <Section title="Cities">
            <div className="flex flex-wrap gap-2 px-2 pb-2">
              {QUICK_CITIES.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => onSelect(c)}
                  className="rounded-full bg-ink-100 px-3 py-1.5 text-sm font-medium hover:bg-ink-200 dark:bg-ink-800 dark:hover:bg-ink-700"
                >
                  {c.name}
                </button>
              ))}
            </div>
          </Section>

          {favourites.length > 0 && (
            <Section title="Favourites">
              <ul role="listbox" aria-label="Favourites">
                {favourites.slice(0, 5).map((p) => (
                  <PlaceRow key={p.id} place={p} onSelect={onSelect} leadingIcon={<Star className="size-5 text-amber-500" fill="currentColor" />} />
                ))}
              </ul>
            </Section>
          )}

          <Section
            title="Recent"
            action={
              recents.length > 0 && (
                <button type="button" onClick={clearRecents} className="flex items-center gap-1 text-xs font-medium text-ink-500 hover:text-red-500">
                  <Trash2 className="size-3.5" /> Clear
                </button>
              )
            }
          >
            {recents.length === 0 ? (
              <p className="px-3 pb-3 text-sm text-ink-500 dark:text-ink-400">Destinations you pick will appear here.</p>
            ) : (
              <ul role="listbox" aria-label="Recent destinations">
                {recents.map((p) => (
                  <PlaceRow
                    key={p.id}
                    place={p}
                    onSelect={onSelect}
                    leadingIcon={<Clock className="size-5" />}
                    trailing={
                      <button
                        type="button"
                        onClick={() => removeRecent(p.id)}
                        aria-label={`Remove ${p.name} from recent`}
                        className="grid size-9 shrink-0 place-items-center rounded-full text-ink-400 hover:bg-ink-100 hover:text-ink-700 dark:hover:bg-ink-800"
                      >
                        <X className="size-4" />
                      </button>
                    }
                  />
                ))}
              </ul>
            )}
          </Section>
        </>
      )}
    </div>
  );
}

function Results({ search, activeIndex, onSelect, pending }: { search: PlaceSearchState; activeIndex: number; onSelect: (p: Place) => void; pending: boolean }) {
  if (search.error) {
    return (
      <div className="flex items-start gap-3 p-3 text-sm">
        <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-500" />
        <div>
          <p className="font-medium">Search failed</p>
          <p className="text-ink-500 dark:text-ink-300">{search.error}</p>
        </div>
      </div>
    );
  }

  if ((search.loading || pending) && search.results.length === 0) {
    return (
      <ul aria-busy className="space-y-1 p-1">
        {[0, 1, 2].map((i) => (
          <li key={i} className="flex animate-pulse items-center gap-3 p-2">
            <span className="size-10 rounded-xl bg-ink-100 dark:bg-ink-800" />
            <span className="flex-1 space-y-2">
              <span className="block h-3 w-2/3 rounded bg-ink-100 dark:bg-ink-800" />
              <span className="block h-2.5 w-1/2 rounded bg-ink-100 dark:bg-ink-800" />
            </span>
          </li>
        ))}
      </ul>
    );
  }

  if (search.results.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 px-4 py-8 text-center text-sm text-ink-500 dark:text-ink-300">
        <SearchX className="size-8 text-ink-300" />
        <p>
          No places found for “<span className="font-medium text-ink-800 dark:text-ink-100">{search.query}</span>”.
        </p>
        {search.mode === 'demo' && <p className="text-xs">Offline sample data only covers major Malaysian cities and landmarks.</p>}
      </div>
    );
  }

  return (
    <>
      {search.mode === 'demo' && (
        <div className="mx-1 mb-1 flex items-start gap-2 rounded-xl bg-amber-400/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
          <DemoBadge label="Demo" className="shrink-0" />
          <span>{search.notice ?? 'Live search not configured — results come from a small offline sample of Malaysian places.'}</span>
        </div>
      )}
      <ul role="listbox" aria-label="Search results">
        {search.results.map((p, i) => (
          <PlaceRow key={p.id} id={optionId(i)} place={p} onSelect={onSelect} active={i === activeIndex} />
        ))}
      </ul>
    </>
  );
}

function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="py-1">
      <div className="flex items-center justify-between px-3 pb-1 pt-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-400">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}
