import { LocateFixed, LocateOff, Locate, Minus, Moon, Navigation2, Plus, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';
import { IconButton } from '@/components/ui/IconButton';
import { useLocation } from '@/contexts/LocationContext';
import { useMapContext } from '@/contexts/MapContext';
import { useTheme } from '@/contexts/ThemeContext';
import { PITCH_3D } from '@/lib/map3d';
import { MapModeToggle } from './MapModeToggle';
import { useT } from '@/lib/i18n';

/** Right-hand stack: theme, compass, zoom. Locate button lives separately (bottom). */
export function MapControls() {
  const [t] = useT();
  const { map, mapMode } = useMapContext();
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

  // In 3D the tilt is expected; the compass shows when rotated (or tilted away from the 3D angle)
  const rotated = Math.abs(bearing) > 0.5 || (mapMode === '3d' ? Math.abs(pitch - PITCH_3D) > 0.5 : pitch > 0.5);

  return (
    <div className="flex flex-col gap-2">
      <MapModeToggle />
      {/* On short phones the bottom button stack reaches this high; theme stays available in Profil */}
      <IconButton label={theme === 'dark' ? t('Tukar ke peta cerah', 'Switch to light map') : t('Tukar ke peta gelap', 'Switch to dark map')} onClick={toggle} className="[@media(max-height:620px)]:hidden">
        {theme === 'dark' ? <Sun className="size-5" /> : <Moon className="size-5" />}
      </IconButton>
      {rotated && (
        <IconButton label={t('Kembalikan peta ke utara', 'Reset map to north')} onClick={() => map?.easeTo({ bearing: 0, pitch: mapMode === '3d' ? PITCH_3D : 0 })}>
          <Navigation2 className="size-5 text-red-500" style={{ transform: `rotate(${-bearing}deg)` }} fill="currentColor" />
        </IconButton>
      )}
      <div className="pointer-events-auto hidden flex-col overflow-hidden rounded-2xl bg-white shadow-float sm:flex dark:bg-ink-800">
        <button type="button" aria-label={t('Zum masuk', 'Zoom in')} title={t('Zum masuk', 'Zoom in')} onClick={() => map?.zoomIn()} className="grid size-11 place-items-center hover:bg-ink-50 dark:hover:bg-ink-700">
          <Plus className="size-5" />
        </button>
        <span className="mx-2 h-px bg-ink-100 dark:bg-ink-700" />
        <button type="button" aria-label={t('Zum keluar', 'Zoom out')} title={t('Zum keluar', 'Zoom out')} onClick={() => map?.zoomOut()} className="grid size-11 place-items-center hover:bg-ink-50 dark:hover:bg-ink-700">
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
