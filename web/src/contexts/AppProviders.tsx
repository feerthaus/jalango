import type { ReactNode } from 'react';
import { LocationProvider } from './LocationContext';
import { MapProvider } from './MapContext';
import { SavedPlacesProvider } from './SavedPlacesContext';
import { ServiceStatusProvider } from './ServiceStatusContext';
import { ThemeProvider } from './ThemeContext';

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <ServiceStatusProvider>
        <LocationProvider>
          <SavedPlacesProvider>
            <MapProvider>{children}</MapProvider>
          </SavedPlacesProvider>
        </LocationProvider>
      </ServiceStatusProvider>
    </ThemeProvider>
  );
}
