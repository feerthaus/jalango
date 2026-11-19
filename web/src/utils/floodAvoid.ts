import type { Coordinates, TrafficReport } from '@/types';
import { haversineMeters } from './geo';

/**
 * Impassable floods (reported "tak boleh lalu") to route around. Skips floods
 * right at the start or the destination (excluding those would leave no route)
 * and keeps the ones closest to the trip, at most `max` (Mapbox takes a few).
 */
export const MAX_AVOID = 10;
const NEAR_END_M = 300;

/** Distance (m) from p to the straight line a→b, in a local flat projection (fine at trip scale). */
function offLine(p: Coordinates, a: Coordinates, b: Coordinates): number {
  const k = Math.cos((a.lat * Math.PI) / 180);
  const ax = a.lng * k, ay = a.lat, bx = b.lng * k, by = b.lat, px = p.lng * k, py = p.lat;
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy || 1e-12;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy)) * 111_320;
}

export function pickAvoidPoints(floods: Pick<TrafficReport, 'report_type' | 'flood_passable' | 'status' | 'latitude' | 'longitude'>[], from: Coordinates, to: Coordinates, max = MAX_AVOID): Coordinates[] {
  return floods
    .filter((r) => r.report_type === 'flood' && r.flood_passable === false && r.status === 'active')
    .map((r) => ({ lat: r.latitude, lng: r.longitude }))
    .filter((p) => haversineMeters(p, from) > NEAR_END_M && haversineMeters(p, to) > NEAR_END_M)
    .sort((a, b) => offLine(a, from, to) - offLine(b, from, to))
    .slice(0, max);
}

/** The area to look for floods in: the trip's box plus a margin (detours can leave the straight line). */
export function tripBounds(from: Coordinates, to: Coordinates, marginKm = 15) {
  const dLat = marginKm / 111;
  const dLng = marginKm / (111 * Math.cos((((from.lat + to.lat) / 2) * Math.PI) / 180));
  return {
    minLat: Math.min(from.lat, to.lat) - dLat,
    maxLat: Math.max(from.lat, to.lat) + dLat,
    minLng: Math.min(from.lng, to.lng) - dLng,
    maxLng: Math.max(from.lng, to.lng) + dLng,
  };
}
