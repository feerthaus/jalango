import type Anthropic from '@anthropic-ai/sdk';
import type { Coordinates } from '../../types.js';
import { getDirections } from '../directions.js';
import { getFuelPrices } from '../fuel.js';
import { smartSearch } from '../searchLearning.js';
import { getTransitNetwork } from '../transit/feeds.js';
import { placesAround } from '../around.js';
import { accessLeg, haversineKm, planTransit, type TransitOption } from '../transit/raptor.js';

/**
 * What the trip assistant can look up. Every fact in its answers comes from
 * here (our own search, planner, routing and fuel prices), never from the
 * model's memory. Results are compact text-like JSON for the model; places
 * found are also returned to the app so the person can tap "Arah".
 */

export interface FoundPlace {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
}

const point = { type: 'number' } as const;
const coords = {
  from_lat: point,
  from_lng: point,
  to_lat: point,
  to_lng: point,
};
const coordKeys = ['from_lat', 'from_lng', 'to_lat', 'to_lng'];

export const TOOLS: Anthropic.Beta.BetaTool[] = [
  {
    name: 'search_place',
    description:
      'Find places in Malaysia by name or address (Mapbox/OpenStreetMap plus JalanGo places). Use it for every place the person names, including stations and airports, to get coordinates. Returns up to 5 matches, nearest to the person first when their location is known.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: { query: { type: 'string', description: 'Place name or address, e.g. "KLIA Terminal 1", "Pavilion KL", "Seksyen 7 Shah Alam"' } },
      required: ['query'],
      additionalProperties: false,
    },
  },
  {
    name: 'plan_public_transport',
    description:
      'Public transport options (KTM Komuter/ETS/Intercity, LRT, MRT, Monorail, BRT, KLIA Ekspres/Transit, Rapid buses) between two points, leaving at or after a time. Returns up to 3 options with leave/arrive times (Malaysia time), lines, changes, walking or Grab to/from stations, and estimated fares in RM.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: {
        ...coords,
        depart_at: { type: ['string', 'null'], description: 'Leave at or after this Malaysia time, ISO 8601 with +08:00 (e.g. "2026-11-19T07:00:00+08:00"); null for now' },
      },
      required: [...coordKeys, 'depart_at'],
      additionalProperties: false,
    },
  },
  {
    name: 'drive_estimate',
    description:
      'Driving between two points with live traffic: minutes, km, whether there are tolls, and estimated one-way fuel (RON95) and toll cost in RM. Parking is not included.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: { ...coords, avoid_tolls: { type: 'boolean' } },
      required: [...coordKeys, 'avoid_tolls'],
      additionalProperties: false,
    },
  },
  {
    name: 'places_around',
    description:
      'Places to eat (kind "makan") or things to see (kind "menarik") around a point, from JalanGo\'s own data: community picks with how many people recommend them, and JalanGo places with how many people confirmed they are still there. There are NO reviews, ratings or opening hours. Up to 10, most recommended first, then nearest. Use the person\'s location when they say "sini"/"dekat sini"/"here".',
    strict: true,
    input_schema: {
      type: 'object',
      properties: { lat: point, lng: point, kind: { type: 'string', enum: ['makan', 'menarik'] }, radius_km: { type: 'number', description: 'Search radius in km, 1 to 10 (default 3)' } },
      required: ['lat', 'lng', 'kind', 'radius_km'],
      additionalProperties: false,
    },
  },
  {
    name: 'taxi_estimate',
    description: 'Rough Grab/taxi time and fare range (RM) between two points, from distance only (no surge pricing).',
    strict: true,
    input_schema: { type: 'object', properties: coords, required: coordKeys, additionalProperties: false },
  },
];

const inMalaysia = (c: Coordinates) => c.lat > 0.5 && c.lat < 7.5 && c.lng > 99 && c.lng < 120;
const r1 = (n: number) => Math.round(n * 10) / 10;
const clock = (iso: string) => iso.slice(11, 16);

function pair(input: Record<string, unknown>): { from: Coordinates; to: Coordinates } {
  const from = { lat: Number(input.from_lat), lng: Number(input.from_lng) };
  const to = { lat: Number(input.to_lat), lng: Number(input.to_lng) };
  if (!inMalaysia(from) || !inMalaysia(to)) throw new Error('Both points must be in Malaysia (use search_place first).');
  return { from, to };
}

function summarize(o: TransitOption) {
  return {
    leave_home: clock(o.leave),
    arrive: clock(o.arrive),
    date: o.leave.slice(0, 10),
    total_minutes: o.minutes,
    changes: o.transfers,
    fare_rm: o.fareMin === o.fareMax ? o.fareMin : `${o.fareMin}-${o.fareMax}`,
    to_first_station: o.access.type === 'walk' ? `walk ${o.access.km} km (~${o.access.minutes} min)` : `Grab ${o.access.km} km (~${o.access.minutes} min, RM${o.access.costMin}-${o.access.costMax})`,
    steps: o.legs.map((l) =>
      l.type === 'walk'
        ? `walk to ${l.to.name} to change (~${l.minutes} min)`
        : `${l.mode === 'erl' ? `KLIA ${l.shortName}` : `${l.mode.toUpperCase()} ${l.shortName}`.trim()} ${clock(l.depart)} ${l.from.name} → ${clock(l.arrive)} ${l.to.name} (${l.stops} stops${l.ticket ? ', buy ticket in advance at KTMB' : ''})`,
    ),
    from_last_station: o.egress.type === 'walk' ? `walk ${o.egress.km} km (~${o.egress.minutes} min)` : `Grab ${o.egress.km} km (~${o.egress.minutes} min, RM${o.egress.costMin}-${o.egress.costMax})`,
    total_cost_rm: o.costMin === o.costMax ? o.costMin : `${o.costMin}-${o.costMax}`,
  };
}

/** Run one tool. Returns the JSON for the model; `places` collects what search found. */
export async function runTool(name: string, input: Record<string, unknown>, ctx: { near?: Coordinates; now: number; places: Map<string, FoundPlace> }): Promise<unknown> {
  switch (name) {
    case 'search_place': {
      const q = String(input.query ?? '').trim().slice(0, 120);
      if (q.length < 2) throw new Error('query too short');
      const { places, rewrittenTo } = await smartSearch(q, ctx.near, 5, { ai: true });
      const found = places.slice(0, 5).map((p) => {
        const f: FoundPlace = { id: p.id, name: p.name, address: p.address, lat: r1(p.coordinates.lat * 1000) / 1000, lng: r1(p.coordinates.lng * 1000) / 1000 };
        ctx.places.set(p.id, { ...f, lat: p.coordinates.lat, lng: p.coordinates.lng });
        return { ...f, km_from_person: p.distanceMeters !== undefined ? r1(p.distanceMeters / 1000) : undefined };
      });
      return { results: found, searched_as: rewrittenTo };
    }
    case 'plan_public_transport': {
      const { from, to } = pair(input);
      const at = typeof input.depart_at === 'string' ? Date.parse(input.depart_at) : NaN;
      const when = Number.isFinite(at) && at > ctx.now - 3600_000 && at < ctx.now + 7 * 86_400_000 ? Math.max(at, ctx.now - 60_000) : ctx.now;
      const options = planTransit(await getTransitNetwork(), from, to, when).slice(0, 3);
      if (!options.length) return { options: [], note: 'No suitable public transport (no station or stop near one end, or the trip is under 1.5 km: walk).' };
      return { options: options.map(summarize), note: 'Times from official timetables (KLIA Ekspres/Transit estimated). Fares are estimates.' };
    }
    case 'drive_estimate': {
      const { from, to } = pair(input);
      const [routes, fuel] = await Promise.all([getDirections(from, to, { avoidTolls: Boolean(input.avoid_tolls) }), getFuelPrices().catch(() => null)]);
      const r = routes[0];
      if (!r) return { error: 'no driving route' };
      const km = r.distanceMeters / 1000;
      const price = fuel?.prices.ron95_budi95 ?? fuel?.prices.ron95_skps ?? fuel?.prices.ron95 ?? 2.05;
      return {
        minutes_with_traffic: Math.round(r.durationSeconds / 60),
        km: r1(km),
        via: r.summary,
        has_tolls: r.hasTolls,
        fuel_rm: r1((km * 7 * price) / 100),
        toll_rm_estimate: r.hasTolls ? Math.round(km * 0.1) : 0,
        fuel_basis: `RON95 RM${price}/L, 7 L/100 km`,
        note: 'Parking not included.',
      };
    }
    case 'taxi_estimate': {
      const { from, to } = pair(input);
      const leg = accessLeg(Math.max(haversineKm(from, to), 2));
      return { km: leg.km, minutes: leg.minutes, fare_rm: `${leg.costMin}-${leg.costMax}`, note: 'Rough estimate without surge; check the Grab app.' };
    }
    case 'places_around': {
      const at = { lat: Number(input.lat), lng: Number(input.lng) };
      if (!inMalaysia(at)) throw new Error('The point must be in Malaysia (use search_place or the person\'s location).');
      const kind = input.kind === 'menarik' ? 'menarik' : 'makan';
      const km = Math.min(10, Math.max(1, Number(input.radius_km) || 3));
      const found = await placesAround(at, kind, Math.round(km * 1000), 10);
      for (const p of found) ctx.places.set(p.id, { id: p.id, name: p.name, address: p.note ?? '', lat: p.lat, lng: p.lng });
      return found.map((p) => ({
        id: p.id,
        name: p.name,
        note: p.note,
        km: r1(p.distanceMeters / 1000),
        recommended_by: p.recommends,
        confirmed_by: p.confirmations,
        source: p.source === 'komuniti' ? 'JalanGo community pick' : p.unverified ? 'map data, not confirmed yet' : 'map data, confirmed by people',
        lat: p.lat,
        lng: p.lng,
      }));
    }
    default:
      throw new Error(`unknown tool ${name}`);
  }
}
