import { useCallback, useEffect, useRef, useState } from 'react';
import type { GeoFix, GeoStatus } from '@/types';

const WATCH_OPTIONS: PositionOptions = { enableHighAccuracy: true, maximumAge: 5_000, timeout: 20_000 };

function initialStatus(): GeoStatus {
  if (typeof navigator === 'undefined' || !('geolocation' in navigator)) return 'unsupported';
  if (typeof window !== 'undefined' && !window.isSecureContext) return 'insecure';
  return 'idle';
}

export interface GeolocationState {
  status: GeoStatus;
  fix: GeoFix | null;
  /** Start (or restart) watching the device position. Triggers the permission prompt. */
  request: () => void;
  stop: () => void;
}

/**
 * Low-level GPS hook: wraps navigator.geolocation.watchPosition with
 * permission handling, error mapping and cleanup.
 */
export function useGeolocation(): GeolocationState {
  const [status, setStatus] = useState<GeoStatus>(initialStatus);
  const [fix, setFix] = useState<GeoFix | null>(null);
  const watchId = useRef<number | null>(null);

  const stop = useCallback(() => {
    if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    watchId.current = null;
  }, []);

  const request = useCallback(() => {
    const base = initialStatus();
    if (base !== 'idle') {
      setStatus(base);
      return;
    }
    stop();
    setStatus((s) => (s === 'active' ? s : 'locating'));
    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        setFix({
          coordinates: { lng: pos.coords.longitude, lat: pos.coords.latitude },
          accuracy: pos.coords.accuracy,
          speed: pos.coords.speed !== null && Number.isFinite(pos.coords.speed) ? pos.coords.speed : null,
          heading: pos.coords.heading !== null && Number.isFinite(pos.coords.heading) ? pos.coords.heading : null,
          timestamp: pos.timestamp,
        });
        setStatus('active');
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          stop();
          setStatus('denied');
        } else if (err.code === err.TIMEOUT) {
          // keep watching — a fix may still arrive — but tell the UI
          setStatus((s) => (s === 'active' ? s : 'timeout'));
        } else {
          setStatus((s) => (s === 'active' ? s : 'unavailable'));
        }
      },
      WATCH_OPTIONS,
    );
  }, [stop]);

  // Auto-start when permission was granted earlier; otherwise wait for a user gesture.
  useEffect(() => {
    if (initialStatus() !== 'idle') return;
    let cancelled = false;
    let permission: PermissionStatus | null = null;
    const onChange = () => {
      if (!permission) return;
      if (permission.state === 'granted') request();
      if (permission.state === 'denied') {
        stop();
        setStatus('denied');
      }
    };

    if (navigator.permissions?.query) {
      navigator.permissions
        .query({ name: 'geolocation' })
        .then((p) => {
          if (cancelled) return;
          permission = p;
          if (p.state === 'granted') request();
          else setStatus(p.state === 'denied' ? 'denied' : 'prompt');
          p.addEventListener('change', onChange);
        })
        .catch(() => !cancelled && setStatus('prompt'));
    } else {
      setStatus('prompt');
    }

    return () => {
      cancelled = true;
      permission?.removeEventListener('change', onChange);
      stop();
    };
  }, [request, stop]);

  return { status, fix, request, stop };
}
