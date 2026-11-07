import { Megaphone, Radio, Users, Utensils, WifiOff } from 'lucide-react';
import { AlongRouteSheet } from '@/components/along/AlongRouteSheet';
import { ConvoyBanner } from '@/components/convoy/ConvoyBanner';
import { ConvoySheet } from '@/components/convoy/ConvoySheet';
import { normalizeConvoyCode } from '@/utils/convoy';
import { useConvoy } from '@/contexts/ConvoyContext';
import { LiveShareBanner } from '@/components/live/LiveShareBanner';
import { ShareLiveSheet } from '@/components/live/ShareLiveSheet';
import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { InstallBanner } from '@/components/pwa/InstallBanner';
import { DemoModeBanner } from '@/components/layout/DemoModeBanner';
import { LocateButton, MapControls } from '@/components/map/MapControls';
import { LocationStatusBanner } from '@/components/map/LocationStatusBanner';
import { SpeedIndicator } from '@/components/map/SpeedIndicator';
import { NavigationHud } from '@/components/navigation/NavigationHud';
import { RoutePanel } from '@/components/navigation/RoutePanel';
import { PlaceCard } from '@/components/places/PlaceCard';
import { ReportDetailCard } from '@/components/reports/ReportDetailCard';
import { ReportSheet } from '@/components/reports/ReportSheet';
import { ShortcutCard } from '@/components/shortcuts/ShortcutCard';
import { useShortcuts } from '@/contexts/ShortcutsContext';
import { DestinationSearch } from '@/components/search/DestinationSearch';
import { IconButton } from '@/components/ui/IconButton';
import { useMapContext } from '@/contexts/MapContext';
import { useReports } from '@/contexts/ReportsContext';
import { useIsNavigating, useRouting } from '@/contexts/RoutingContext';

export function MapPage() {
  const { selectedPlace, clearSelection, tileError } = useMapContext();
  const { status } = useRouting();
  const { selectedReport, selectReport } = useReports();
  const { selectedShortcut, selectShortcut } = useShortcuts();
  const navigating = useIsNavigating();
  const planning = !navigating && status !== 'idle';
  const [searchOpen, setSearchOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [alongOpen, setAlongOpen] = useState(false);
  const [convoyOpen, setConvoyOpen] = useState<{ code: string | null } | null>(null);
  const [params, setParams] = useSearchParams();
  // Home-screen shortcut "Report" opens /?report=1
  useEffect(() => {
    if (params.get('report') === '1') {
      setReportOpen(true);
      setParams({}, { replace: true });
    }
    // Convoy invite links (/convoy/CODE) land here as /?convoy=CODE
    const code = params.get('convoy');
    if (code !== null) {
      setConvoyOpen({ code: normalizeConvoyCode(code) });
      setParams({}, { replace: true });
    }
  }, [params, setParams]);
  const onSearchOpenChange = useCallback((open: boolean) => setSearchOpen(open), []);

  const reportButton = (
    <IconButton label="Report a road incident" size="lg" onClick={() => setReportOpen(true)} className="!bg-amber-400 !text-ink-950 hover:!bg-amber-300">
      <Megaphone className="size-6" />
    </IconButton>
  );

  if (navigating) {
    return (
      <>
        <NavigationHud />
        {status === 'navigating' && (
          <div className="absolute inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+6.5rem+var(--host-badge-h))] z-20 space-y-3 p-3 md:bottom-28 md:w-[420px] md:p-4">
            <div className="flex items-end justify-between">
              <SpeedIndicator />
              <div className="ml-auto flex flex-col items-end gap-3">
                <ConvoyButton onOpen={() => setConvoyOpen({ code: null })} />
                <IconButton label="Tempat makan & menarik sepanjang laluan" onClick={() => setAlongOpen(true)}>
                  <Utensils className="size-5 text-violet-600 dark:text-violet-400" />
                </IconButton>
                {reportButton}
              </div>
            </div>
            {selectedReport && <ReportDetailCard report={selectedReport} onClose={() => selectReport(null)} />}
          </div>
        )}
        {reportOpen && <ReportSheet onClose={() => setReportOpen(false)} />}
        {alongOpen && <AlongRouteSheet onClose={() => setAlongOpen(false)} />}
        {convoyOpen && <ConvoySheet joinCode={convoyOpen.code} onClose={() => setConvoyOpen(null)} />}
      </>
    );
  }

  return (
    <>
      {/* Top: search + status (hidden on mobile while choosing a route) */}
      <div className={planning ? 'absolute inset-x-0 top-0 z-30 space-y-2 p-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] max-md:hidden md:w-[420px] md:p-4' : 'absolute inset-x-0 top-0 z-30 space-y-2 p-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] md:w-[420px] md:p-4'}>
        {!planning && <DestinationSearch onOpenChange={onSearchOpenChange} />}
        {planning && <RoutePanel />}
        {!searchOpen && !planning && (
          <div className="space-y-2 max-md:mr-14">
            <LiveShareBanner />
            <ConvoyBanner />
            <DemoModeBanner />
            {tileError && (
              <div role="status" className="pointer-events-auto inline-flex max-w-full items-center gap-2 rounded-full bg-ink-900/90 px-3 py-1.5 text-xs text-white shadow-float">
                <WifiOff className="size-3.5 shrink-0" /> Some map tiles failed to load — check your connection
              </div>
            )}
            <LocationStatusBanner />
            {!selectedPlace && !selectedReport && !selectedShortcut && <InstallBanner />}
          </div>
        )}
      </div>

      {/* Right: map controls */}
      <div className="absolute right-3 top-[calc(env(safe-area-inset-top)+5.25rem)] z-10 md:right-4 md:top-4">
        <MapControls />
      </div>

      {/* Bottom area (above nav on mobile) */}
      <div className="absolute inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-10 space-y-3 p-3 md:bottom-0 md:p-4">
        {!planning && (
          <div className="flex items-end justify-between gap-3">
            <SpeedIndicator />
            <div className="ml-auto flex flex-col items-end gap-3">
              <ConvoyButton onOpen={() => setConvoyOpen({ code: null })} />
              <IconButton label="Share live location" onClick={() => setShareOpen(true)}>
                <Radio className="size-5 text-jade-600 dark:text-jade-400" />
              </IconButton>
              {reportButton}
              <LocateButton />
            </div>
          </div>
        )}
        {planning && (
          <div className="md:hidden">
            <RoutePanel />
          </div>
        )}
        {!planning && selectedShortcut && !selectedPlace && (
          <div className="md:max-w-[400px]">
            <ShortcutCard shortcut={selectedShortcut} onClose={() => selectShortcut(null)} />
          </div>
        )}
        {!planning && selectedReport && !selectedPlace && !selectedShortcut && (
          <div className="md:max-w-[400px]">
            <ReportDetailCard report={selectedReport} onClose={() => selectReport(null)} />
          </div>
        )}
        {!planning && selectedPlace && (
          <div className="md:max-w-[400px]">
            <PlaceCard place={selectedPlace} onClose={clearSelection} />
          </div>
        )}
      </div>

      {reportOpen && <ReportSheet onClose={() => setReportOpen(false)} />}
      {shareOpen && <ShareLiveSheet onClose={() => setShareOpen(false)} />}
      {convoyOpen && <ConvoySheet joinCode={convoyOpen.code} onClose={() => setConvoyOpen(null)} />}
    </>
  );
}

/** Konvoi button; shows how many cars are in your convoy. */
function ConvoyButton({ onOpen }: { onOpen: () => void }) {
  const { convoy, members } = useConvoy();
  return (
    <div className="relative">
      <IconButton label="Konvoi (group travel)" onClick={onOpen} active={Boolean(convoy)}>
        <Users className="size-5 text-violet-600 dark:text-violet-400" />
      </IconButton>
      {convoy && (
        <span className="pointer-events-none absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-violet-600 px-1 text-[11px] font-bold text-white ring-2 ring-white dark:ring-ink-900">
          {members.length}
        </span>
      )}
    </div>
  );
}
