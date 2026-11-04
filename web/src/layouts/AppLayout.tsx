import { Outlet } from 'react-router';
import { BottomNav } from '@/components/layout/BottomNav';
import { MapView } from '@/components/map/MapView';
import { useIsNavigating } from '@/contexts/RoutingContext';

/**
 * Shell: persistent full-screen map, routed overlay content, and navigation.
 * The map stays mounted while switching tabs.
 */
export function AppLayout() {
  const navigating = useIsNavigating();
  return (
    <div className={navigating ? 'relative h-dvh w-full overflow-hidden [--map-bottom-inset:6.5rem]' : 'relative h-dvh w-full overflow-hidden [--map-bottom-inset:calc(4rem+env(safe-area-inset-bottom))] md:[--map-bottom-inset:0px]'}>
      <div className={navigating ? 'absolute inset-0' : 'absolute inset-0 md:left-20'}>
        <MapView />
      </div>
      <main className={navigating ? 'pointer-events-none absolute inset-0 z-20' : 'pointer-events-none absolute inset-0 z-20 md:left-20'}>
        <Outlet />
      </main>
      {!navigating && <BottomNav />}
    </div>
  );
}
