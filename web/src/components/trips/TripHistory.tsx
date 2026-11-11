import { ChevronDown, Users, CornerUpRight, Flag, History, Route as RouteIcon, Share2, Star, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { canShareAsCommunityRoute, ShareCommunityRouteSheet } from '@/components/communityRoutes/ShareCommunityRouteSheet';
import { ShareShortcutSheet } from '@/components/shortcuts/ShareShortcutSheet';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { useRouting } from '@/contexts/RoutingContext';
import { useTrips } from '@/contexts/TripsContext';
import { cn } from '@/lib/cn';
import type { Trip } from '@/types';
import { formatDuration } from '@/utils/format';
import { formatDistance } from '@/utils/geo';
import { RateTrip, TRIP_TAGS } from './RateTrip';
import { TripRouteActions } from './SavedRoutes';

export function TripHistory() {
  const { trips } = useTrips();
  if (trips.length === 0) {
    return (
      <div className="rounded-2xl bg-white p-2 shadow-sm ring-1 ring-ink-200 dark:bg-ink-900 dark:ring-ink-800">
        <EmptyState icon={History} title="No trips yet">
          Trips you navigate with JalanGo are saved here, so you can rate them, go again or share a shortcut.
        </EmptyState>
      </div>
    );
  }
  return (
    <ul className="space-y-2" aria-label="Trip history">
      {trips.map((t) => (
        <TripItem key={t.id} trip={t} />
      ))}
    </ul>
  );
}

function TripItem({ trip }: { trip: Trip }) {
  const [open, setOpen] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [sharingRoute, setSharingRoute] = useState(false);
  const [editing, setEditing] = useState(false);
  const { removeTrip } = useTrips();
  const { planRoute } = useRouting();
  const navigate = useNavigate();
  const date = new Date(trip.startedAt);

  const goAgain = () => {
    planRoute({ id: trip.destination.placeId ?? `trip:${trip.id}`, name: trip.destination.name, address: trip.destination.address ?? '', coordinates: trip.destination.coordinates, kind: 'other', source: 'mapbox' });
    navigate('/');
  };

  return (
    <li className="rounded-2xl bg-white shadow-sm ring-1 ring-ink-200 dark:bg-ink-900 dark:ring-ink-800">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center gap-3 p-3 text-left">
        <span className={cn('grid size-10 shrink-0 place-items-center rounded-xl', trip.arrived ? 'bg-jade-500/15 text-jade-600 dark:text-jade-400' : 'bg-ink-100 text-ink-500 dark:bg-ink-800')}>
          {trip.arrived ? <Flag className="size-5" /> : <RouteIcon className="size-5" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{trip.destination.name}</span>
          <span className="block text-xs text-ink-500 dark:text-ink-400">
            {date.toLocaleDateString('en-MY', { day: 'numeric', month: 'short' })}, {date.toLocaleTimeString('en-MY', { hour: 'numeric', minute: '2-digit' })} ·{' '}
            {formatDuration(trip.durationSeconds)} · {formatDistance(trip.distanceMeters)}
            {!trip.arrived && ' · ended early'}
          </span>
        </span>
        {trip.rating ? (
          <span className="flex shrink-0 items-center gap-0.5 text-sm font-semibold text-amber-500">
            <Star className="size-4" fill="currentColor" /> {trip.rating}
          </span>
        ) : (
          <span className="shrink-0 rounded-full bg-amber-400/15 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300">Rate</span>
        )}
        <ChevronDown className={cn('size-4 shrink-0 text-ink-400 transition', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="space-y-3 border-t border-ink-100 p-3 dark:border-ink-800">
          {trip.routeSummary && <p className="text-xs text-ink-500">Route: {trip.routeSummary}</p>}
          {trip.rating && trip.ratingTags?.length ? (
            <p className="text-xs text-ink-500">{trip.ratingTags.map((t) => TRIP_TAGS.find((x) => x.id === t)?.label).filter(Boolean).join(' · ')}</p>
          ) : null}
          {trip.rating && !editing ? (
            <button type="button" onClick={() => setEditing(true)} className="text-xs font-semibold text-jade-600 dark:text-jade-400">
              Edit rating
            </button>
          ) : (
            <RateTrip trip={trip} compact onDone={() => setEditing(false)} />
          )}
          <div className="grid grid-cols-3 gap-2">
            <Button variant="secondary" className="px-2 text-xs" onClick={goAgain}>
              <CornerUpRight className="size-4" /> Go again
            </Button>
            <Button variant="secondary" className="px-2 text-xs" onClick={() => setSharing(true)} disabled={!trip.trace}>
              <Share2 className="size-4" /> Shortcut
            </Button>
            <Button variant="danger" className="px-2 text-xs" onClick={() => removeTrip(trip.id)}>
              <Trash2 className="size-4" /> Delete
            </Button>
          </div>
          <TripRouteActions trip={trip} />
          {canShareAsCommunityRoute(trip) && (
            <Button variant="secondary" className="w-full text-xs" onClick={() => setSharingRoute(true)}>
              <Users className="size-4" /> Kongsi sebagai laluan komuniti
            </Button>
          )}
        </div>
      )}
      {sharingRoute && <ShareCommunityRouteSheet trip={trip} onClose={() => setSharingRoute(false)} />}
      {sharing && <ShareShortcutSheet trip={trip} onClose={() => setSharing(false)} />}
    </li>
  );
}
