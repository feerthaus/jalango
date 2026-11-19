import type { StateCode } from '@/utils/malaysiaState';
import { apiGet } from './apiClient';

/** MetMalaysia land warnings (thunderstorm, rain, bad weather), from our API (data.gov.my). */
export interface WeatherWarning {
  id: string;
  kind: 'thunderstorm' | 'rain' | 'bad_weather';
  title_bm: string;
  title_en: string;
  text_bm: string;
  text_en: string;
  issued: string;
  valid_from: string | null;
  valid_to: string | null;
  states: StateCode[];
}

export async function fetchWeatherWarnings(signal?: AbortSignal): Promise<WeatherWarning[]> {
  const { warnings } = await apiGet<{ warnings: WeatherWarning[] }>('/weather/warnings', {}, signal);
  return warnings;
}
