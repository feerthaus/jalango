import { apiGet } from './apiClient';

export interface FuelPrices {
  date: string;
  prices: Record<string, number>;
  change: Record<string, number>;
  source: string;
}

let cached: Promise<FuelPrices> | null = null;

/** This week's official pump prices (data.gov.my), fetched once per session. */
export function loadFuel(): Promise<FuelPrices> {
  cached ??= apiGet<FuelPrices>('/fuel').catch((err) => {
    cached = null;
    throw err;
  });
  return cached;
}
