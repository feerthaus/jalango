import { Clock, Star, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { PlaceRow } from '@/components/places/PlaceRow';
import { SavedRoutes } from '@/components/trips/SavedRoutes';
import { TripHistory } from '@/components/trips/TripHistory';
import { useSavedRoutes } from '@/lib/savedRoutes';
import { cn } from '@/lib/cn';
import { useTrips } from '@/contexts/TripsContext';
import { EmptyState } from '@/components/ui/EmptyState';
import { PagePanel } from '@/components/ui/PagePanel';
import { useSavedPlaces } from '@/contexts/SavedPlacesContext';
import { useShowOnMap } from '@/hooks/useShowOnMap';
import { formatRelativeTime } from '@/utils/format';
import { useT } from '@/lib/i18n';

export function SavedPage() {
  const [tr] = useT();
  const { favourites, recents, removeFavourite, removeRecent, clearRecents } = useSavedPlaces();
  const showOnMap = useShowOnMap();
  const { trips } = useTrips();
  const [tab, setTab] = useState<'places' | 'routes' | 'trips'>('places');
  const { routes } = useSavedRoutes();

  return (
    <PagePanel title={tr('Simpanan', 'Saved')} subtitle={tr('Tempat dan sejarah perjalanan', 'Places and trip history')}>
      <div role="tablist" className="mb-2 grid grid-cols-3 gap-1 rounded-2xl bg-ink-100 p-1 dark:bg-ink-900">
        {(['places', 'routes', 'trips'] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={cn('rounded-xl py-2 text-sm font-semibold', tab === t ? 'bg-white shadow-sm dark:bg-ink-700' : 'text-ink-500')}
          >
            {t === 'places' ? `${tr('Tempat', 'Places')} (${favourites.length})` : t === 'routes' ? `${tr('Laluan', 'Routes')} (${routes.length})` : `${tr('Perjalanan', 'Trips')} (${trips.length})`}
          </button>
        ))}
      </div>
      {tab === 'trips' ? (
        <TripHistory />
      ) : tab === 'routes' ? (
        <SavedRoutes />
      ) : (
      <>
      <h2 className="px-1 pb-2 pt-2 text-xs font-semibold uppercase tracking-wider text-ink-400">{tr('Kegemaran', 'Favourites')}</h2>
      <div className="rounded-2xl bg-white p-2 shadow-sm ring-1 ring-ink-200 dark:bg-ink-900 dark:ring-ink-800">
        {favourites.length === 0 ? (
          <EmptyState icon={Star} title={tr('Belum ada kegemaran', 'No favourites yet')}>
            Search for a place and tap <strong>Save</strong> to keep it here — home, office, your usual R&amp;R.
          </EmptyState>
        ) : (
          <ul role="listbox" aria-label="Favourite places">
            {favourites.map((p) => (
              <PlaceRow
                key={p.id}
                place={p}
                onSelect={(place) => showOnMap(place)}
                leadingIcon={<Star className="size-5 text-amber-500" fill="currentColor" />}
                trailing={<RemoveButton label={`Remove ${p.name} from favourites`} onClick={() => removeFavourite(p.id)} />}
              />
            ))}
          </ul>
        )}
      </div>

      <div className="flex items-center justify-between px-1 pb-2 pt-6">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-400">{tr('Destinasi terkini', 'Recent destinations')}</h2>
        {recents.length > 0 && (
          <button type="button" onClick={clearRecents} className="flex items-center gap-1 text-xs font-medium text-ink-500 hover:text-red-500">
            <Trash2 className="size-3.5" /> Clear all
          </button>
        )}
      </div>
      <div className="rounded-2xl bg-white p-2 shadow-sm ring-1 ring-ink-200 dark:bg-ink-900 dark:ring-ink-800">
        {recents.length === 0 ? (
          <EmptyState icon={Clock} title={tr('Tiada destinasi terkini', 'No recent destinations')}>{tr('Tempat yang anda cari akan muncul di sini.', 'Places you search for will show up here.')}</EmptyState>
        ) : (
          <ul role="listbox" aria-label="Recent destinations">
            {recents.map((p) => (
              <PlaceRow
                key={p.id}
                place={{ ...p, address: `${formatRelativeTime(p.savedAt)} · ${p.address}` }}
                onSelect={() => showOnMap(p)}
                leadingIcon={<Clock className="size-5" />}
                trailing={<RemoveButton label={`Remove ${p.name} from recent`} onClick={() => removeRecent(p.id)} />}
              />
            ))}
          </ul>
        )}
      </div>
      </>
      )}
    </PagePanel>
  );
}

function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="grid size-9 shrink-0 place-items-center rounded-full text-ink-400 hover:bg-ink-100 hover:text-ink-700 dark:hover:bg-ink-800 dark:hover:text-ink-100"
    >
      <X className="size-4" />
    </button>
  );
}
