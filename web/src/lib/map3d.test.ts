import { describe, expect, it } from 'vitest';
import { buildingSupport, buildingsBeforeId, buildingsLayer, BUILDINGS_LAYER } from './map3d';

describe('map3d', () => {
  it('detects how a style can show 3D buildings', () => {
    expect(buildingSupport({ sources: {}, imports: [{ id: 'basemap' }] })).toBe('config');
    expect(buildingSupport({ sources: { composite: { type: 'vector', url: 'mapbox://mapbox.mapbox-streets-v8,mapbox.mapbox-traffic-v1' } } })).toBe('extrusion');
    expect(buildingSupport({ sources: { basemap: { type: 'raster', tiles: [] } } })).toBe('none');
    expect(buildingSupport(null)).toBe('none');
  });
  it('puts buildings under our route layers and labels', () => {
    expect(buildingsBeforeId([{ id: 'road', type: 'line' }, { id: 'jg-route-alt', type: 'line' }, { id: 'road-label', type: 'symbol' }])).toBe('jg-route-alt');
    expect(buildingsBeforeId([{ id: 'road', type: 'line' }, { id: 'road-label', type: 'symbol' }])).toBe('road-label');
    expect(buildingsBeforeId([{ id: BUILDINGS_LAYER, type: 'fill-extrusion' }, { id: 'poi', type: 'symbol' }])).toBe('poi');
  });
  it('builds a themed extrusion layer from Streets building heights', () => {
    const l = buildingsLayer('dark');
    expect(l).toMatchObject({ id: BUILDINGS_LAYER, type: 'fill-extrusion', source: 'composite', 'source-layer': 'building', minzoom: 14 });
    expect(l.paint?.['fill-extrusion-color']).toBe('#26324a');
    expect(buildingsLayer('light').paint?.['fill-extrusion-color']).toBe('#d5dbe4');
  });
});
