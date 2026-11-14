import { useEffect, useMemo, useState } from 'react';
import { listingToPlace, VERIFIED_MAX_OFFSET_M } from '@/contexts/AlongContext';
import { useRouting } from '@/contexts/RoutingContext';
import { features } from '@/lib/config';
import { fetchPublicListings, type PublicListing } from '@/services/marketService';
import { rankAlong } from '@/utils/alongRoute';
import { buildRouteIndex } from '@/utils/routeProgress';

/**
 * Food businesses checked by JalanGo that lie along the chosen route (≤3 km
 * off it). Used while planning, before the drive starts.
 */
export function useVerifiedFoodOnRoute(): PublicListing[] {
  const { selectedRoute } = useRouting();
  const [all, setAll] = useState<PublicListing[] | null>(null);
  useEffect(() => {
    if (!features.supabase || !selectedRoute || selectedRoute.source === 'demo' || all) return;
    let alive = true;
    fetchPublicListings('food').then((l) => alive && setAll(l), () => alive && setAll([]));
    return () => {
      alive = false;
    };
  }, [selectedRoute, all]);
  return useMemo(() => {
    if (!all?.length || !selectedRoute) return [];
    const index = buildRouteIndex(selectedRoute);
    return rankAlong(all, (l) => ({ lat: l.latitude, lng: l.longitude }), index, 0, VERIFIED_MAX_OFFSET_M, 0).map((r) => r.item);
  }, [all, selectedRoute]);
}

export { listingToPlace };
