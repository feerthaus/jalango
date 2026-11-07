import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { features } from '@/lib/config';
import { fetchServerHealth, type ServerHealth } from '@/services/healthService';
import type { ServiceMode } from '@/types';

interface ServiceStatusValue {
  /** Place search: live Mapbox via our API, or offline sample data */
  searchMode: ServiceMode;
  /** Basemap: Mapbox vector tiles, or the open demo raster basemap */
  tilesMode: Exclude<ServiceMode, 'checking'>;
  server: ServerHealth | null;
  isDemo: boolean;
  refresh: () => void;
}

const ServiceStatusContext = createContext<ServiceStatusValue | null>(null);

export function ServiceStatusProvider({ children }: { children: ReactNode }) {
  const [server, setServer] = useState<ServerHealth | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    fetchServerHealth(controller.signal).then((h) => !controller.signal.aborted && setServer(h));
    return () => controller.abort();
  }, [nonce]);

  // Server unreachable (weak signal when the app opened)? Check again quietly.
  useEffect(() => {
    if (!server || server.reachable) return;
    const id = setTimeout(() => setNonce((n) => n + 1), 20_000);
    const online = () => setNonce((n) => n + 1);
    window.addEventListener('online', online);
    return () => {
      clearTimeout(id);
      window.removeEventListener('online', online);
    };
  }, [server]);

  const refresh = useCallback(() => {
    setServer(null);
    setNonce((n) => n + 1);
  }, []);

  const value = useMemo<ServiceStatusValue>(() => {
    const searchMode: ServiceMode = server === null ? 'checking' : server.reachable && server.mapbox ? 'live' : 'demo';
    const tilesMode = features.mapboxTiles ? 'live' : 'demo';
    return { searchMode, tilesMode, server, isDemo: searchMode === 'demo' || tilesMode === 'demo', refresh };
  }, [server, refresh]);

  return <ServiceStatusContext.Provider value={value}>{children}</ServiceStatusContext.Provider>;
}

export function useServiceStatus(): ServiceStatusValue {
  const ctx = useContext(ServiceStatusContext);
  if (!ctx) throw new Error('useServiceStatus must be used within ServiceStatusProvider');
  return ctx;
}
