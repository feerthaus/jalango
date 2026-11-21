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
import { LiveShareProvider } from './LiveShareContext';
import { ConvoyProvider } from './ConvoyContext';
import { ConvoyChatProvider } from './ConvoyChatContext';
import { AlongProvider } from './AlongContext';
import { CamerasProvider } from './CamerasContext';
import { ItineraryProvider } from './ItineraryContext';
import { AccidentsProvider } from './AccidentsContext';

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
                        <ReportsProvider>
                          <ItineraryProvider>
                            <LiveShareProvider>
                              <ConvoyProvider>
                                <ConvoyChatProvider>
                                <AlongProvider>
                                  <CamerasProvider>
                                    <AccidentsProvider>{children}</AccidentsProvider>
                                  </CamerasProvider>
                                </AlongProvider>
                                </ConvoyChatProvider>
                              </ConvoyProvider>
                            </LiveShareProvider>
                          </ItineraryProvider>
                        </ReportsProvider>
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
