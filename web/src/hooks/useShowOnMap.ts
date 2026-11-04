import { useCallback } from 'react';
import { useNavigate } from 'react-router';
import { useMapContext } from '@/contexts/MapContext';
import { useSavedPlaces } from '@/contexts/SavedPlacesContext';
import type { Place } from '@/types';

/** From any tab: switch to the map and focus a place. */
export function useShowOnMap() {
  const navigate = useNavigate();
  const { selectPlace } = useMapContext();
  const { addRecent } = useSavedPlaces();
  return useCallback(
    (place: Place, { remember = true } = {}) => {
      selectPlace(place);
      if (remember) addRecent(place);
      navigate('/');
    },
    [navigate, selectPlace, addRecent],
  );
}
