import type { Coordinates } from '@/types';
import { haversineMeters } from './geo';

/**
 * Rough costs for "Kereta vs Tren". Every number here is an estimate and is
 * labelled as one on screen.
 */

/** Litres per 100 km for a typical vehicle. */
export const CONSUMPTION = { car: 7, motorcycle: 3 } as const;

/** Highway toll for a car, RM per km (PLUS class 1 is about RM0.10/km). Motorcycles: free on most. */
export const TOLL_PER_KM = 0.1;

interface ParkingZone {
  name: string;
  at: Coordinates;
  km: number;
  /** RM per day */
  perDay: number;
}

/** City centres where parking costs money, roughly what a day costs there. */
export const PARKING_ZONES: ParkingZone[] = [
  { name: 'KLCC / Bukit Bintang', at: { lat: 3.1520, lng: 101.7120 }, km: 3, perDay: 25 },
  { name: 'KL Sentral / Bangsar', at: { lat: 3.1343, lng: 101.6865 }, km: 2, perDay: 20 },
  { name: 'Kuala Lumpur', at: { lat: 3.1390, lng: 101.6869 }, km: 8, perDay: 15 },
  { name: 'Petaling Jaya', at: { lat: 3.1073, lng: 101.6067 }, km: 6, perDay: 10 },
  { name: 'Shah Alam / Subang', at: { lat: 3.0738, lng: 101.5183 }, km: 8, perDay: 8 },
  { name: 'Putrajaya', at: { lat: 2.9264, lng: 101.6964 }, km: 6, perDay: 5 },
  { name: 'George Town', at: { lat: 5.4141, lng: 100.3288 }, km: 5, perDay: 12 },
  { name: 'Johor Bahru', at: { lat: 1.4655, lng: 103.7578 }, km: 6, perDay: 12 },
  { name: 'Melaka', at: { lat: 2.1896, lng: 102.2501 }, km: 5, perDay: 10 },
  { name: 'Ipoh', at: { lat: 4.5975, lng: 101.0901 }, km: 5, perDay: 6 },
  { name: 'Seremban', at: { lat: 2.7259, lng: 101.9378 }, km: 5, perDay: 6 },
  { name: 'Kuantan', at: { lat: 3.8077, lng: 103.3260 }, km: 5, perDay: 6 },
  { name: 'Kota Bharu', at: { lat: 6.1254, lng: 102.2381 }, km: 5, perDay: 6 },
  { name: 'Kuala Terengganu', at: { lat: 5.3302, lng: 103.1408 }, km: 5, perDay: 6 },
  { name: 'Alor Setar', at: { lat: 6.1248, lng: 100.3678 }, km: 5, perDay: 5 },
  { name: 'Kota Kinabalu', at: { lat: 5.9804, lng: 116.0735 }, km: 6, perDay: 10 },
  { name: 'Kuching', at: { lat: 1.5535, lng: 110.3593 }, km: 6, perDay: 8 },
];

/** Daily parking near a destination (0 outside the listed city centres: usually free). */
export function parkingPerDay(dest: Coordinates): { perDay: number; zone: string | null } {
  for (const z of PARKING_ZONES) if (haversineMeters(dest, z.at) <= z.km * 1000) return { perDay: z.perDay, zone: z.name };
  return { perDay: 0, zone: null };
}

export interface CarCost {
  fuel: number;
  toll: number;
  parking: number;
  total: number;
  litres: number;
}

/** One-way drive: fuel + estimated toll + parking for `days` at the destination. */
export function carTripCost(o: { distanceMeters: number; hasTolls: boolean; vehicle: 'car' | 'motorcycle'; fuelPrice: number; parkingPerDay: number; days: number }): CarCost {
  const km = o.distanceMeters / 1000;
  const litres = (km * CONSUMPTION[o.vehicle]) / 100;
  const fuel = Math.round(litres * o.fuelPrice);
  const toll = o.hasTolls && o.vehicle === 'car' ? Math.round(km * TOLL_PER_KM) : 0;
  const parking = Math.round(o.parkingPerDay * Math.max(0, o.days));
  return { fuel, toll, parking, total: fuel + toll + parking, litres: Math.round(litres * 10) / 10 };
}

/** Train for `people`: fares per person; the ride to/from the station is shared. */
export function trainTripCost(o: { fareMin: number; fareMax: number; rideMin: number; rideMax: number; people: number }): { min: number; max: number } {
  const n = Math.max(1, o.people);
  return { min: Math.round(o.fareMin * n + o.rideMin), max: Math.round(o.fareMax * n + o.rideMax) };
}

/** RON95: the subsidised BUDI95 price most Malaysians pay, else the open price. */
export function pickFuelPrice(prices: Record<string, number> | undefined): { price: number; label: string } | null {
  if (!prices) return null;
  const budi = prices.ron95_budi95;
  if (typeof budi === 'number' && budi > 0) return { price: budi, label: 'RON95 BUDI95' };
  if (typeof prices.ron95 === 'number' && prices.ron95 > 0) return { price: prices.ron95, label: 'RON95' };
  return null;
}
