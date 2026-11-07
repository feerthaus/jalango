import { Check, Copy, CornerUpRight, Heart, ListPlus, Share2, Star, ThumbsUp, Users, X } from 'lucide-react';
import { RecommendPlaceSheet } from '@/components/community/RecommendPlaceSheet';
import { FlagButton } from '@/components/moderation/FlagButton';
import { useCommunityPlaces } from '@/contexts/CommunityPlacesContext';
import { useAuth } from '@/contexts/AuthContext';
import { categoryMeta } from '@/lib/communityCategories';
import type { CommunityCategory } from '@/types';
import { useRouting } from '@/contexts/RoutingContext';
import { useConvoy } from '@/contexts/ConvoyContext';
import { useItinerary } from '@/contexts/ItineraryContext';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { DemoBadge } from '@/components/ui/DemoBadge';
import { useLocation } from '@/contexts/LocationContext';
import { useSavedPlaces } from '@/contexts/SavedPlacesContext';
import type { Place } from '@/types';
import { formatCoordinates, formatDistance, haversineMeters } from '@/utils/geo';
import { placeIcon } from './placeIcon';
import { googleMapsReviewsUrl } from '@/utils/googleMapsLink';

/** Bottom card for the selected destination. */
export function PlaceCard({ place, onClose }: { place: Place; onClose: () => void }) {
  const { fix } = useLocation();
  const { isFavourite, toggleFavourite } = useSavedPlaces();
  const { planRoute } = useRouting();
  const [copied, setCopied] = useState(false);
  const [recommending, setRecommending] = useState(false);
  const { user } = useAuth();
  const convoy = useConvoy();
  const itinerary = useItinerary();
  const inItinerary = itinerary.has(place);
  const [convoyMsg, setConvoyMsg] = useState<string | null>(null);
  const setForConvoy = (which: 'meet' | 'destination') => {
    const p = { name: place.name, coordinates: place.coordinates };
    (which === 'meet' ? convoy.setMeetPoint(p) : convoy.setDestination(p))
      .then(() => setConvoyMsg(which === 'meet' ? 'Titik berkumpul ditetapkan untuk konvoi.' : 'Destinasi konvoi dikemas kini.'))
      .catch((e: unknown) => setConvoyMsg(e instanceof Error ? e.message : 'Gagal.'));
  };
  const community = useCommunityPlaces();
  const pick = place.source === 'community' ? community.findById(place.id.replace(/^community:/, '')) : undefined;
  const picked = pick ? community.recommended.has(pick.id) : false;
  const canShare = typeof navigator.share === 'function';
  const Icon = placeIcon(place);
  const saved = isFavourite(place.id);
  const distance = fix ? haversineMeters(fix.coordinates, place.coordinates) : null;
  const coords = formatCoordinates(place.coordinates);
  const mapsUrl = `https://www.openstreetmap.org/?mlat=${place.coordinates.lat}&mlon=${place.coordinates.lng}#map=17/${place.coordinates.lat}/${place.coordinates.lng}`;

  const share = async () => {
    const text = `${place.name}${place.address ? ` — ${place.address}` : ''} (${coords})`;
    try {
      if (canShare) {
        await navigator.share({ title: place.name, text, url: mapsUrl });
        return;
      }
      await navigator.clipboard.writeText(`${text}\n${mapsUrl}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* user cancelled the share sheet or clipboard blocked */
    }
  };

  return (
    <article
      aria-label={`Selected place: ${place.name}`}
      className="glass pointer-events-auto animate-slide-up rounded-3xl p-4 shadow-float ring-1 ring-ink-900/5 dark:ring-white/10"
    >
      <div className="flex items-start gap-3">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-red-500/10 text-red-500">
          <Icon className="size-6" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-lg font-bold leading-tight">{place.name}</h2>
            {place.source === 'demo' && <DemoBadge label="Sample place" />}
            {pick && (
              <span className="rounded-full bg-jade-500/15 px-2 py-0.5 text-[11px] font-semibold text-jade-700 dark:text-jade-300">
                Community pick · {categoryMeta(pick.category).label}
              </span>
            )}
          </div>
          {place.address && <p className="mt-0.5 line-clamp-2 text-sm text-ink-500 dark:text-ink-300">{place.address}</p>}
          {pick?.description && <p className="mt-1 text-sm">“{pick.description}”</p>}
          {pick && (
            <div className="mt-1">
              <FlagButton type="place" id={pick.id} ownerId={pick.user_id} />
            </div>
          )}
          <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-500 dark:text-ink-400">
            {distance !== null && (
              <span title="Straight-line distance from your location. Road distance comes with route calculation.">
                <strong className="font-semibold text-ink-800 dark:text-ink-100">{formatDistance(distance)}</strong> away (straight line)
              </span>
            )}
            <span className="tabular-nums">{coords}</span>
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="-mr-1 -mt-1 grid size-9 place-items-center rounded-full text-ink-500 hover:bg-ink-100 dark:hover:bg-ink-800"
        >
          <X className="size-5" />
        </button>
      </div>

      <Button className="mt-4 w-full py-3 text-base" onClick={() => planRoute(place)}>
        <CornerUpRight className="size-5" /> Directions
      </Button>
      <div className="mt-2 grid grid-cols-3 gap-2">
        <Button variant="secondary" className={saved ? 'text-amber-600 dark:text-amber-400' : undefined} onClick={() => toggleFavourite(place)} aria-pressed={saved}>
          <Star className="size-4" fill={saved ? 'currentColor' : 'none'} />
          {saved ? 'Saved' : 'Save'}
        </Button>
        <Button variant="secondary" onClick={share}>
          {copied ? <Check className="size-4" /> : canShare ? <Share2 className="size-4" /> : <Copy className="size-4" />}
          {copied ? 'Copied' : 'Share'}
        </Button>
        {pick ? (
          <Button
            variant={picked ? 'primary' : 'secondary'}
            aria-pressed={picked}
            disabled={!user || pick.user_id === user.id}
            onClick={() => void community.toggleRecommend(pick.id).catch(() => {})}
            title={!user ? 'Sign in to recommend' : undefined}
          >
            <ThumbsUp className="size-4" /> {pick.recommend_count}
          </Button>
        ) : (
          <Button variant="secondary" onClick={() => setRecommending(true)} disabled={!community.available}>
            <Heart className="size-4" /> Recommend
          </Button>
        )}
      </div>
      <Button variant="secondary" className="mt-2 w-full" onClick={() => !inItinerary && itinerary.add(place)} disabled={inItinerary} aria-pressed={inItinerary}>
        {inItinerary ? <Check className="size-4" /> : <ListPlus className="size-4" />} {inItinerary ? 'Dalam itinerari' : '+ Itinerari'}
      </Button>
      {place.source !== 'demo' && (
        <a
          href={googleMapsReviewsUrl(place)}
          target="_blank"
          rel="noreferrer"
          className="mt-2 flex items-center justify-center gap-1.5 rounded-xl py-2 text-sm font-semibold text-ink-600 hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-ink-800"
        >
          <Star className="size-4 text-amber-500" fill="currentColor" /> Baca review di Google Maps
        </a>
      )}
      {convoy.isLeader && (
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Button variant="secondary" className="text-xs text-violet-700 dark:text-violet-300" onClick={() => setForConvoy('meet')}>
            <Users className="size-4" /> Titik berkumpul
          </Button>
          <Button variant="secondary" className="text-xs text-violet-700 dark:text-violet-300" onClick={() => setForConvoy('destination')}>
            <Users className="size-4" /> Destinasi konvoi
          </Button>
          {convoyMsg && <p role="status" className="col-span-2 text-xs text-ink-500">{convoyMsg}</p>}
        </div>
      )}
      {recommending && (
        <RecommendPlaceSheet
          initial={{ name: place.name, address: place.address, coordinates: place.coordinates, category: guessCategory(place.category) }}
          onClose={() => setRecommending(false)}
        />
      )}
    </article>
  );
}

function guessCategory(category?: string): CommunityCategory | undefined {
  const c = category?.toLowerCase() ?? '';
  if (/restaurant|food|nasi|mamak|eat/.test(c)) return 'food';
  if (/cafe|coffee/.test(c)) return 'cafe';
  if (/hotel|resort|homestay/.test(c)) return 'stay';
  if (/park|beach|waterfall|hill|nature|lake/.test(c)) return 'nature';
  if (/landmark|museum|attraction|mall|tourist/.test(c)) return 'attraction';
  return undefined;
}
