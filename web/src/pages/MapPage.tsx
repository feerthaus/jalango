import { Megaphone, WifiOff } from 'lucide-react';
import { useCallback, useState } from 'react';
import { DemoModeBanner } from '@/components/layout/DemoModeBanner';
import { LocateButton, MapControls } from '@/components/map/MapControls';
import { LocationStatusBanner } from '@/components/map/LocationStatusBanner';
import { SpeedIndicator } from '@/components/map/SpeedIndicator';
import { PlaceCard } from '@/components/places/PlaceCard';
import { ReportSheet } from '@/components/reports/ReportSheet';
import { DestinationSearch } from '@/components/search/DestinationSearch';
import { IconButton } from '@/components/ui/IconButton';
import { useMapContext } from '@/contexts/MapContext';

export function MapPage() {
  const { selectedPlace, clearSelection, tileError } = useMapContext();
  const [searchOpen, setSearchOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const onSearchOpenChange = useCallback((open: boolean) => setSearchOpen(open), []);

  return (
    <>
      {/* Top: search + status */}
      <div className="absolute inset-x-0 top-0 z-30 space-y-2 p-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] md:w-[420px] md:p-4">
        <DestinationSearch onOpenChange={onSearchOpenChange} />
        {!searchOpen && (
          <div className="space-y-2 max-md:mr-14">
            <DemoModeBanner />
            {tileError && (
              <div role="status" className="pointer-events-auto inline-flex max-w-full items-center gap-2 rounded-full bg-ink-900/90 px-3 py-1.5 text-xs text-white shadow-float">
                <WifiOff className="size-3.5 shrink-0" /> Some map tiles failed to load — check your connection
              </div>
            )}
            <LocationStatusBanner />
          </div>
        )}
      </div>

      {/* Right: map controls */}
      <div className="absolute right-3 top-[calc(env(safe-area-inset-top)+5.25rem)] z-10 md:right-4 md:top-4">
        <MapControls />
      </div>

      {/* Bottom area (above nav on mobile) */}
      <div className="absolute inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-10 space-y-3 p-3 md:bottom-0 md:p-4">
        <div className="flex items-end justify-between gap-3">
          <SpeedIndicator />
          <div className="ml-auto flex flex-col items-end gap-3">
            <IconButton label="Report a road incident" size="lg" onClick={() => setReportOpen(true)} className="!bg-amber-400 !text-ink-950 hover:!bg-amber-300">
              <Megaphone className="size-6" />
            </IconButton>
            <LocateButton />
          </div>
        </div>
        {selectedPlace && (
          <div className="md:max-w-[400px]">
            <PlaceCard place={selectedPlace} onClose={clearSelection} />
          </div>
        )}
      </div>

      {reportOpen && <ReportSheet onClose={() => setReportOpen(false)} />}
    </>
  );
}
