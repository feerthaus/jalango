import type { FillExtrusionLayerSpecification, StyleSpecification } from 'mapbox-gl';
import type { ResolvedTheme } from '@/contexts/ThemeContext';

export type MapMode = '2d' | '3d';

const MODE_KEY = 'jalango:map-mode';
/** Camera tilt in 3D mode (the map allows up to 60°). */
export const PITCH_3D = 55;
/** Tilt of the existing 2D driving camera (kept as it was before 3D mode). */
export const PITCH_2D_DRIVING = 50;
export const BUILDINGS_LAYER = 'jg-3d-buildings';

export function readMapMode(): MapMode {
  try {
    return localStorage.getItem(MODE_KEY) === '3d' ? '3d' : '2d';
  } catch {
    return '2d';
  }
}
export function saveMapMode(m: MapMode): void {
  try {
    localStorage.setItem(MODE_KEY, m);
  } catch {
    /* private mode: just don't remember */
  }
}

/**
 * How the loaded style can show 3D buildings:
 * - 'config': a Mapbox Standard-based style (imports a `basemap`): use
 *   setConfigProperty('basemap', 'show3dObjects', …);
 * - 'extrusion': a classic Mapbox style with the Streets v8 `composite`
 *   source (our Navigation day/night styles): add one fill-extrusion layer;
 * - 'none': e.g. the raster demo basemap: tilt only, no building data.
 */
export type BuildingSupport = 'config' | 'extrusion' | 'none';

export function buildingSupport(style: Pick<StyleSpecification, 'sources'> & { imports?: { id: string }[] } | undefined | null): BuildingSupport {
  if (!style) return 'none';
  if ((style.imports ?? []).some((i) => i.id === 'basemap')) return 'config';
  const composite = style.sources?.composite as { type?: string; url?: string } | undefined;
  if (composite?.type === 'vector' && /mapbox\.mapbox-streets-v[78]/.test(composite.url ?? '')) return 'extrusion';
  return 'none';
}

/** Muted 3D buildings that sit under the route and labels. */
export function buildingsLayer(theme: ResolvedTheme): FillExtrusionLayerSpecification {
  const dark = theme === 'dark';
  return {
    id: BUILDINGS_LAYER,
    type: 'fill-extrusion',
    source: 'composite',
    'source-layer': 'building',
    minzoom: 14,
    filter: ['==', ['get', 'extrude'], 'true'],
    paint: {
      'fill-extrusion-color': dark ? '#26324a' : '#d5dbe4',
      // grow in from flat between z14 and z15 so the switch isn't abrupt
      'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 14, 0, 15, ['get', 'height']],
      'fill-extrusion-base': ['interpolate', ['linear'], ['zoom'], 14, 0, 15, ['get', 'min_height']],
      'fill-extrusion-opacity': dark ? 0.8 : 0.7,
    },
  };
}

/**
 * Insert buildings below our own layers (route, shortcuts: ids "jg-…") and
 * below the first label layer, so routes and names always draw on top.
 */
export function buildingsBeforeId(layers: { id: string; type: string }[]): string | undefined {
  return layers.find((l) => (l.id.startsWith('jg-') && l.id !== BUILDINGS_LAYER) || l.type === 'symbol')?.id;
}
