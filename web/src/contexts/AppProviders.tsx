import type { ReactNode } from 'react';
import { LocationProvider } from './LocationContext';
import { MapProvider } from './MapContext';
import { RoutingProvider } from './RoutingContext';
import { SavedPlacesProvider } from './SavedPlacesContext';
import { ServiceStatusProvider } from './ServiceStatusContext';
import { ThemeProvider } from './ThemeContext';

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <ServiceStatusProvider>
        <LocationProvider>
          <SavedPlacesProvider>
            <MapProvider>
              <RoutingProvider>{children}</RoutingProvider>
            </MapProvider>
          </SavedPlacesProvider>
        </LocationProvider>
      </ServiceStatusProvider>
    </ThemeProvider>
  );
}
