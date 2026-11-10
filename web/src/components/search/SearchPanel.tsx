import { AlertTriangle, Clock, ExternalLink, Link2, SearchX, Star, Trash2, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { PlaceRow } from '@/components/places/PlaceRow';
import { DemoBadge } from '@/components/ui/DemoBadge';
import { DEMO_PLACES } from '@/data/demoPlaces';
import { useSavedPlaces } from '@/contexts/SavedPlacesContext';
import type { PlaceSearchState } from '@/hooks/usePlaceSearch';
import type { Place } from '@/types';
import { useT } from '@/lib/i18n';
import { LINK_UNREADABLE, looksLikeLinkOrCoords } from '@/services/geocodingService';

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
  const [t] = useT();
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
          <Section title={t('Bandar', 'Cities')}>
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
            <Section title={t('Kegemaran', 'Favourites')}>
              <ul role="listbox" aria-label="Favourites">
                {favourites.slice(0, 5).map((p) => (
                  <PlaceRow key={p.id} place={p} onSelect={onSelect} leadingIcon={<Star className="size-5 text-amber-500" fill="currentColor" />} />
                ))}
              </ul>
            </Section>
          )}

          <Section
            title={t('Terkini', 'Recent')}
            action={
              recents.length > 0 && (
                <button type="button" onClick={clearRecents} className="flex items-center gap-1 text-xs font-medium text-ink-500 hover:text-red-500">
                  <Trash2 className="size-3.5" /> {t('Padam', 'Clear')}
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
  const [t] = useT();
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
    const link = looksLikeLinkOrCoords(search.query);
    return (
      <div className="flex flex-col items-center gap-2 px-4 py-6 text-center text-sm text-ink-500 dark:text-ink-300">
        <SearchX className="size-8 text-ink-300" />
        {link || search.notice === LINK_UNREADABLE ? (
          <p>{t('Tak dapat baca lokasi dari pautan ini. Pastikan ia pautan Google Maps ke tempat di Malaysia.', 'Couldn’t read a location from this link. Make sure it’s a Google Maps link to a place in Malaysia.')}</p>
        ) : (
          <p>
            {t('Tiada tempat ditemui untuk', 'No places found for')} “<span className="font-medium text-ink-800 dark:text-ink-100">{search.query}</span>”.
          </p>
        )}
        {search.mode === 'demo' && <p className="text-xs">Offline sample data only covers major Malaysian cities and landmarks.</p>}
        {!link && search.mode !== 'demo' && <GoogleMapsHelp query={search.query} />}
      </div>
    );
  }

  return (
    <>
      {search.mode === 'demo' && (
        <div className="mx-1 mb-1 flex items-start gap-2 rounded-xl bg-amber-400/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
          <DemoBadge label="Demo" className="shrink-0" />
          <span>{search.notice ?? t('Carian langsung tidak tersedia — hasil daripada sampel kecil tempat di Malaysia.', 'Live search not configured — results come from a small offline sample of Malaysian places.')}</span>
        </div>
      )}
      <ul role="listbox" aria-label="Search results">
        {search.results.map((p, i) => (
          <PlaceRow key={p.id} id={optionId(i)} place={p} onSelect={onSelect} active={i === activeIndex} />
        ))}
      </ul>
      {search.mode === 'live' && !looksLikeLinkOrCoords(search.query) && (
        <div className="mt-1 border-t border-ink-100 px-2 pt-2 dark:border-ink-800">
          <GoogleMapsHelp query={search.query} compact />
        </div>
      )}
    </>
  );
}

/**
 * Not here? Look it up in Google Maps (a plain link: no API, no Google data in JalanGo),
 * then share or copy the place's link and paste it into our search.
 */
function GoogleMapsHelp({ query, compact }: { query: string; compact?: boolean }) {
  const [t] = useT();
  const href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${query}, Malaysia`)}`;
  return (
    <div className={compact ? 'flex items-center gap-2 text-xs text-ink-500' : 'mt-1 flex w-full flex-col items-center gap-2'}>
      {compact && <span className="min-w-0 flex-1">{t('Tak jumpa tempat yang betul?', 'Not the right place?')}</span>}
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={compact ? 'flex shrink-0 items-center gap-1 rounded-lg bg-ink-100 px-2.5 py-1.5 font-semibold text-ink-700 dark:bg-ink-800 dark:text-ink-200' : 'flex items-center gap-1.5 rounded-xl bg-ink-100 px-3 py-2 font-semibold text-ink-800 dark:bg-ink-800 dark:text-ink-100'}
      >
        <ExternalLink className="size-3.5" /> {t('Cari di Google Maps', 'Search in Google Maps')}
      </a>
      {!compact && (
        <p className="flex items-start gap-1.5 text-left text-xs">
          <Link2 className="mt-0.5 size-3.5 shrink-0" />
          {t('Jumpa di sana? Tekan Kongsi → Salin pautan, kemudian tampal pautan itu di kotak carian ini.', 'Found it there? Tap Share → Copy link, then paste the link into this search box.')}
        </p>
      )}
    </div>
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
