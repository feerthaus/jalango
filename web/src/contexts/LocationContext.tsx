import { createContext, useContext, type ReactNode } from 'react';
import { useGeolocation, type GeolocationState } from '@/hooks/useGeolocation';

const LocationContext = createContext<GeolocationState | null>(null);

/** Single GPS watcher shared by the whole app. */
export function LocationProvider({ children }: { children: ReactNode }) {
  const geo = useGeolocation();
  return <LocationContext.Provider value={geo}>{children}</LocationContext.Provider>;
}

export function useLocation(): GeolocationState {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error('useLocation must be used within LocationProvider');
  return ctx;
}
