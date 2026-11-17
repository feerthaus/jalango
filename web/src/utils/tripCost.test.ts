import { describe, expect, it } from 'vitest';
import { carTripCost, parkingPerDay, pickFuelPrice, trainTripCost } from './tripCost';

describe('trip cost estimates', () => {
  it('car: fuel + toll + parking days', () => {
    const c = carTripCost({ distanceMeters: 200_000, hasTolls: true, vehicle: 'car', fuelPrice: 1.99, parkingPerDay: 6, days: 2 });
    expect(c).toEqual({ fuel: 28, toll: 20, parking: 12, total: 60, litres: 14 });
    expect(carTripCost({ distanceMeters: 200_000, hasTolls: false, vehicle: 'car', fuelPrice: 1.99, parkingPerDay: 0, days: 1 }).toll).toBe(0);
    expect(carTripCost({ distanceMeters: 200_000, hasTolls: true, vehicle: 'motorcycle', fuelPrice: 1.99, parkingPerDay: 0, days: 1 })).toMatchObject({ toll: 0, fuel: 12 });
  });

  it('parking by city centre, free elsewhere', () => {
    expect(parkingPerDay({ lat: 3.1579, lng: 101.7116 })).toEqual({ perDay: 25, zone: 'KLCC / Bukit Bintang' });
    expect(parkingPerDay({ lat: 4.6, lng: 101.09 }).zone).toBe('Ipoh');
    expect(parkingPerDay({ lat: 4.2, lng: 101.3 })).toEqual({ perDay: 0, zone: null });
  });

  it('train: fares per person, station rides shared', () => {
    expect(trainTripCost({ fareMin: 31, fareMax: 45, rideMin: 14, rideMax: 21, people: 2 })).toEqual({ min: 76, max: 111 });
  });

  it('fuel price: BUDI95 first', () => {
    expect(pickFuelPrice({ ron95_budi95: 1.99, ron95: 2.6 })).toEqual({ price: 1.99, label: 'RON95 BUDI95' });
    expect(pickFuelPrice({ ron95: 2.6 })).toEqual({ price: 2.6, label: 'RON95' });
    expect(pickFuelPrice(undefined)).toBeNull();
  });
});
