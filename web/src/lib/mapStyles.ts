import type { StyleSpecification } from 'mapbox-gl';
import type { ResolvedTheme } from '@/contexts/ThemeContext';

/**
 * Mapbox Navigation styles are tuned for driving and include Mapbox's live
 * traffic congestion layer (real data supplied by Mapbox).
 */
export const MAPBOX_STYLES: Record<ResolvedTheme, string> = {
  light: 'mapbox://styles/mapbox/navigation-day-v1',
  dark: 'mapbox://styles/mapbox/navigation-night-v1',
};

/**
 * Demo basemap used when no Mapbox public token is configured: open
 * OpenStreetMap data rendered by CARTO. Real map data, but no traffic layer.
 */
export function demoStyle(theme: ResolvedTheme): StyleSpecification {
  const variant = theme === 'dark' ? 'dark_all' : 'rastertiles/voyager';
  return {
    version: 8,
    name: `jalango-demo-${theme}`,
    sources: {
      basemap: {
        type: 'raster',
        tiles: ['a', 'b', 'c', 'd'].map((s) => `https://${s}.basemaps.cartocdn.com/${variant}/{z}/{x}/{y}@2x.png`),
        tileSize: 256,
        maxzoom: 20,
        attribution:
          '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors © <a href="https://carto.com/attributions" target="_blank" rel="noreferrer">CARTO</a>',
      },
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': theme === 'dark' ? '#0b1220' : '#eef2f6' } },
      { id: 'basemap', type: 'raster', source: 'basemap' },
    ],
  };
}

export function styleFor(theme: ResolvedTheme, useMapbox: boolean): string | StyleSpecification {
  return useMapbox ? MAPBOX_STYLES[theme] : demoStyle(theme);
}
