import type { ReactNode } from 'react';
import { AuthProvider } from './AuthContext';
import { LocationProvider } from './LocationContext';
import { ReportsProvider } from './ReportsContext';
import { MapProvider } from './MapContext';
import { RoutingProvider } from './RoutingContext';
import { SavedPlacesProvider } from './SavedPlacesContext';
import { ServiceStatusProvider } from './ServiceStatusContext';
import { ThemeProvider } from './ThemeContext';
import { TripsProvider } from './TripsContext';
import { ShortcutsProvider } from './ShortcutsContext';
import { CommunityPlacesProvider } from './CommunityPlacesContext';

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ServiceStatusProvider>
          <LocationProvider>
            <SavedPlacesProvider>
              <MapProvider>
                <TripsProvider>
                  <ShortcutsProvider>
                    <CommunityPlacesProvider>
                      <RoutingProvider>
                        <ReportsProvider>{children}</ReportsProvider>
                      </RoutingProvider>
                    </CommunityPlacesProvider>
                  </ShortcutsProvider>
                </TripsProvider>
              </MapProvider>
            </SavedPlacesProvider>
          </LocationProvider>
        </ServiceStatusProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
