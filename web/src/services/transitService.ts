import type { Coordinates } from '@/types';
import { apiGet } from './apiClient';

export interface AccessLeg {
  type: 'walk' | 'ride';
  km: number;
  minutes: number;
  costMin: number;
  costMax: number;
}

export interface Station {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

export interface TrainLeg {
  type: 'train';
  kind: 'ets' | 'intercity' | 'komuter' | 'shuttle';
  routeId: string;
  routeName: string;
  color: string;
  tripId: string;
  from: Station;
  to: Station;
  depart: string;
  arrive: string;
  km: number;
  stops: number;
  fareMin: number;
  fareMax: number;
  ticket: boolean;
  path: [number, number][];
}

export interface TrainOption {
  leave: string;
  arrive: string;
  minutes: number;
  transfers: number;
  access: AccessLeg;
  legs: TrainLeg[];
  egress: AccessLeg;
  fareMin: number;
  fareMax: number;
  costMin: number;
  costMax: number;
}

/** KTMB trains (ETS, Intercity, Komuter) from here to there, leaving now. Fares are estimates. */
export async function fetchTrainOptions(from: Coordinates, to: Coordinates, signal?: AbortSignal): Promise<TrainOption[]> {
  const { options } = await apiGet<{ options: TrainOption[] }>('/transit/train', { from: `${from.lng.toFixed(5)},${from.lat.toFixed(5)}`, to: `${to.lng.toFixed(5)},${to.lat.toFixed(5)}` }, signal);
  return options;
}

/** Official KTMB ticketing (KITS). Phase 1: a link out; partner booking comes later. */
export const KTMB_BOOKING_URL = 'https://online.ktmb.com.my/';
