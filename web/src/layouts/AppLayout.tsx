import { Outlet } from 'react-router';
import { BottomNav } from '@/components/layout/BottomNav';
import { MapView } from '@/components/map/MapView';

/**
 * Shell: persistent full-screen map, routed overlay content, and navigation.
 * The map stays mounted while switching tabs.
 */
export function AppLayout() {
  return (
    <div className="relative h-dvh w-full overflow-hidden [--map-bottom-inset:calc(4rem+env(safe-area-inset-bottom))] md:[--map-bottom-inset:0px]">
      <div className="absolute inset-0 md:left-20">
        <MapView />
      </div>
      <main className="pointer-events-none absolute inset-0 z-20 md:left-20">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
