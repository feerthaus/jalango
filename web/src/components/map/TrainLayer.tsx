import type { GeoJSONSource, Map as MapboxMap } from 'mapbox-gl';
import type { Feature, FeatureCollection, LineString, Point } from 'geojson';
import { useEffect, useMemo } from 'react';
import { useMapContext } from '@/contexts/MapContext';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useTrainView, type TrainView } from '@/lib/trainView';
import { useTransitTrip } from '@/lib/transitTrip';

const SOURCE = 'jg-train';
const LAYERS = { access: 'jg-train-access', casing: 'jg-train-casing', line: 'jg-train-line', stations: 'jg-train-stations', labels: 'jg-train-labels' } as const;

type Props = { kind: 'access' | 'train' | 'station'; color?: string; name?: string };

/** Lines for each train leg (in its line colour), dashed walk/ride to and from the stations, and the stations. */
export function trainFeatures(v: TrainView): FeatureCollection<LineString | Point, Props> {
  const o = v.option;
  const rides = o.legs.filter((l) => l.type === 'transit');
  const first = rides[0].from;
  const last = rides[rides.length - 1].to;
  const features: Feature<LineString | Point, Props>[] = [
    { type: 'Feature', geometry: { type: 'LineString', coordinates: [[v.from.lng, v.from.lat], [first.lng, first.lat]] }, properties: { kind: 'access' } },
    { type: 'Feature', geometry: { type: 'LineString', coordinates: [[last.lng, last.lat], [v.to.lng, v.to.lat]] }, properties: { kind: 'access' } },
  ];
  for (const l of o.legs) {
    if (l.type === 'transit') features.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: l.path }, properties: { kind: 'train', color: l.color } });
    else features.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: [[l.from.lng, l.from.lat], [l.to.lng, l.to.lat]] }, properties: { kind: 'access' } });
  }
  const stations = new Map<string, { lng: number; lat: number; name: string }>();
  for (const l of rides) for (const s of [l.from, l.to]) stations.set(s.id, { lng: s.lng, lat: s.lat, name: s.name });
  for (const s of stations.values()) features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [s.lng, s.lat] }, properties: { kind: 'station', name: s.name } });
  return { type: 'FeatureCollection', features };
}

const EMPTY: FeatureCollection = { type: 'FeatureCollection', features: [] };

function ensureLayers(map: MapboxMap, data: FeatureCollection) {
  const source = map.getSource(SOURCE) as GeoJSONSource | undefined;
  if (source) return source.setData(data);
  map.addSource(SOURCE, { type: 'geojson', data });
  const layout = { 'line-join': 'round', 'line-cap': 'round' } as const;
  map.addLayer({ id: LAYERS.access, type: 'line', source: SOURCE, filter: ['==', ['get', 'kind'], 'access'], layout, paint: { 'line-color': '#8f9bb3', 'line-width': 4, 'line-dasharray': [1, 1.5] } });
  map.addLayer({ id: LAYERS.casing, type: 'line', source: SOURCE, filter: ['==', ['get', 'kind'], 'train'], layout, paint: { 'line-color': '#ffffff', 'line-width': 10 } });
  map.addLayer({ id: LAYERS.line, type: 'line', source: SOURCE, filter: ['==', ['get', 'kind'], 'train'], layout, paint: { 'line-color': ['coalesce', ['get', 'color'], '#3c5a9f'], 'line-width': 6 } });
  map.addLayer({
    id: LAYERS.stations,
    type: 'circle',
    source: SOURCE,
    filter: ['==', ['get', 'kind'], 'station'],
    paint: { 'circle-radius': 7, 'circle-color': '#ffffff', 'circle-stroke-color': '#0b1220', 'circle-stroke-width': 3 },
  });
  try {
    map.addLayer({
      id: LAYERS.labels,
      type: 'symbol',
      source: SOURCE,
      filter: ['==', ['get', 'kind'], 'station'],
      layout: { 'text-field': ['get', 'name'], 'text-size': 13, 'text-offset': [0, 1.2], 'text-anchor': 'top', 'text-optional': true },
      paint: { 'text-color': '#0b1220', 'text-halo-color': '#ffffff', 'text-halo-width': 1.5 },
    });
  } catch {
    /* style without fonts (demo basemap): circles only */
  }
}

/** Draws the train option picked in the route panel's "Tren" tab, and frames it. */
export function TrainLayer() {
  const { map } = useMapContext();
  const shown = useTrainView();
  const trip = useTransitTrip();
  // The Awam tab's option while choosing; otherwise the trip being followed
  const tripView = useMemo(() => (trip ? { option: trip.option, from: trip.from, to: trip.to } : null), [trip?.startedAt]); // eslint-disable-line react-hooks/exhaustive-deps
  const view = shown ?? tripView;
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const data = useMemo(() => (view ? trainFeatures(view) : EMPTY), [view]);

  useEffect(() => {
    if (!map) return;
    const apply = () => {
      try {
        ensureLayers(map, data);
      } catch {
        /* style not ready: 'style.load' calls again */
      }
    };
    apply();
    map.on('style.load', apply);
    return () => {
      map.off('style.load', apply);
    };
  }, [map, data]);

  useEffect(() => {
    if (!map || !view) return;
    const pts: [number, number][] = [[view.from.lng, view.from.lat], [view.to.lng, view.to.lat], ...view.option.legs.flatMap((l): [number, number][] => (l.type === 'transit' ? l.path : [[l.from.lng, l.from.lat], [l.to.lng, l.to.lat]]))];
    const lngs = pts.map((p) => p[0]);
    const lats = pts.map((p) => p[1]);
    const h = map.getContainer().clientHeight;
    map.fitBounds(
      [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
      { padding: isDesktop ? { top: 80, bottom: 80, left: 460, right: 80 } : { top: 70, bottom: Math.min(h * 0.62, 520), left: 40, right: 40 }, maxZoom: 14, duration: 700, pitch: 0, bearing: 0 },
    );
  }, [map, view, isDesktop]);

  return null;
}
