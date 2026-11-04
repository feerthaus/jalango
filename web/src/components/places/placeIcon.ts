import { Building2, Fuel, Hash, Landmark, MapPin, Navigation, Plane, ShoppingBag, Train, type LucideIcon } from 'lucide-react';
import type { Place } from '@/types';

export function placeIcon(place: Pick<Place, 'kind' | 'category'>): LucideIcon {
  const cat = place.category?.toLowerCase() ?? '';
  if (/gas|fuel|petrol/.test(cat)) return Fuel;
  if (/airport/.test(cat)) return Plane;
  if (/station|transit|rail/.test(cat)) return Train;
  if (/mall|shop/.test(cat)) return ShoppingBag;
  if (/landmark|monument|bridge/.test(cat)) return Landmark;
  switch (place.kind) {
    case 'postcode':
      return Hash;
    case 'place':
    case 'locality':
    case 'district':
    case 'region':
      return Building2;
    case 'street':
      return Navigation;
    default:
      return MapPin;
  }
}
