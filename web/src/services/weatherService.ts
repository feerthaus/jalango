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
  const body = await apiGet<{ warnings?: unknown }>('/weather/warnings', {}, signal);
  // Never let an odd answer break the map: keep only well-formed warnings
  if (!Array.isArray(body?.warnings)) return [];
  return body.warnings.filter((w): w is WeatherWarning => Boolean(w) && typeof w === 'object' && Array.isArray((w as WeatherWarning).states) && typeof (w as WeatherWarning).id === 'string');
}
