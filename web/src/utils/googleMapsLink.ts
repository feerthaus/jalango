import type { Place } from '@/types';

/**
 * Public Google Maps search link (no API key, no Places data in our app):
 * opens the Google Maps app / site on this place so people can read its reviews.
 */
export function googleMapsReviewsUrl(place: Pick<Place, 'name' | 'address' | 'coordinates'>): string {
  const { lat, lng } = place.coordinates;
  const query = place.address ? `${place.name}, ${place.address}` : `${place.name} near ${lat.toFixed(5)},${lng.toFixed(5)}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
