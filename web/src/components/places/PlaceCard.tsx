import { Check, Copy, Share2, Star, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { DemoBadge } from '@/components/ui/DemoBadge';
import { useLocation } from '@/contexts/LocationContext';
import { useSavedPlaces } from '@/contexts/SavedPlacesContext';
import type { Place } from '@/types';
import { formatCoordinates, formatDistance, haversineMeters } from '@/utils/geo';
import { placeIcon } from './placeIcon';

/** Bottom card for the selected destination. */
export function PlaceCard({ place, onClose }: { place: Place; onClose: () => void }) {
  const { fix } = useLocation();
  const { isFavourite, toggleFavourite } = useSavedPlaces();
  const [copied, setCopied] = useState(false);
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
          </div>
          {place.address && <p className="mt-0.5 line-clamp-2 text-sm text-ink-500 dark:text-ink-300">{place.address}</p>}
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

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button variant={saved ? 'primary' : 'secondary'} onClick={() => toggleFavourite(place)} aria-pressed={saved}>
          <Star className="size-4" fill={saved ? 'currentColor' : 'none'} />
          {saved ? 'Saved' : 'Save'}
        </Button>
        <Button variant="secondary" onClick={share}>
          {copied ? <Check className="size-4" /> : canShare ? <Share2 className="size-4" /> : <Copy className="size-4" />}
          {copied ? 'Copied' : 'Share'}
        </Button>
      </div>
    </article>
  );
}
