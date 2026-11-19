import { useEffect, useState } from 'react';
import { useServiceStatus } from '@/contexts/ServiceStatusContext';
import { fetchWeatherWarnings, type WeatherWarning } from '@/services/weatherService';

const REFRESH_MS = 10 * 60_000;

/** Current MetMalaysia warnings, refreshed every 10 minutes (empty when offline). */
export function useWeatherWarnings(): WeatherWarning[] {
  const { server } = useServiceStatus();
  const [warnings, setWarnings] = useState<WeatherWarning[]>([]);
  const reachable = Boolean(server?.reachable);
  useEffect(() => {
    if (!reachable) return;
    let alive = true;
    const load = () => fetchWeatherWarnings().then((w) => alive && setWarnings(w)).catch(() => undefined);
    void load();
    const id = window.setInterval(load, REFRESH_MS);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [reachable]);
  // drop ones that ended since the last refresh
  return warnings.filter((w) => !w.valid_to || Date.parse(w.valid_to) > Date.now());
}
