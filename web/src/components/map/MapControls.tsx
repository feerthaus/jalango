import { LocateFixed, LocateOff, Locate, Minus, Moon, Navigation2, Plus, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';
import { IconButton } from '@/components/ui/IconButton';
import { useLocation } from '@/contexts/LocationContext';
import { useMapContext } from '@/contexts/MapContext';
import { useTheme } from '@/contexts/ThemeContext';

/** Right-hand stack: theme, compass, zoom. Locate button lives separately (bottom). */
export function MapControls() {
  const { map } = useMapContext();
  const { theme, toggle } = useTheme();
  const [bearing, setBearing] = useState(0);
  const [pitch, setPitch] = useState(0);

  useEffect(() => {
    if (!map) return;
    const update = () => {
      setBearing(map.getBearing());
      setPitch(map.getPitch());
    };
    update();
    map.on('rotate', update);
    map.on('pitch', update);
    return () => {
      map.off('rotate', update);
      map.off('pitch', update);
    };
  }, [map]);

  const rotated = Math.abs(bearing) > 0.5 || pitch > 0.5;

  return (
    <div className="flex flex-col gap-2">
      <IconButton label={theme === 'dark' ? 'Switch to light map' : 'Switch to dark map'} onClick={toggle}>
        {theme === 'dark' ? <Sun className="size-5" /> : <Moon className="size-5" />}
      </IconButton>
      {rotated && (
        <IconButton label="Reset map to north" onClick={() => map?.easeTo({ bearing: 0, pitch: 0 })}>
          <Navigation2 className="size-5 text-red-500" style={{ transform: `rotate(${-bearing}deg)` }} fill="currentColor" />
        </IconButton>
      )}
      <div className="pointer-events-auto hidden flex-col overflow-hidden rounded-2xl bg-white shadow-float sm:flex dark:bg-ink-800">
        <button type="button" aria-label="Zoom in" title="Zoom in" onClick={() => map?.zoomIn()} className="grid size-11 place-items-center hover:bg-ink-50 dark:hover:bg-ink-700">
          <Plus className="size-5" />
        </button>
        <span className="mx-2 h-px bg-ink-100 dark:bg-ink-700" />
        <button type="button" aria-label="Zoom out" title="Zoom out" onClick={() => map?.zoomOut()} className="grid size-11 place-items-center hover:bg-ink-50 dark:hover:bg-ink-700">
          <Minus className="size-5" />
        </button>
      </div>
    </div>
  );
}

export function LocateButton() {
  const { map, following, setFollowing, flyTo } = useMapContext();
  const { status, fix, request } = useLocation();

  const onClick = () => {
    if (fix) {
      flyTo(fix.coordinates, Math.max(map?.getZoom() ?? 15, 15));
      setFollowing(true);
      return;
    }
    request();
    setFollowing(true);
  };

  const blocked = status === 'denied' || status === 'unsupported' || status === 'insecure';
  const label = blocked ? 'Location unavailable' : following && fix ? 'Following your location' : 'Show my location';

  return (
    <IconButton label={label} active={following && !!fix} onClick={onClick} size="lg">
      {blocked ? (
        <LocateOff className="size-6 text-red-500" />
      ) : status === 'locating' ? (
        <Locate className="size-6 animate-pulse" />
      ) : (
        <LocateFixed className="size-6" />
      )}
    </IconButton>
  );
}
