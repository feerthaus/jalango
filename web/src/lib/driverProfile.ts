import { useCallback, useSyncExternalStore } from 'react';

/** Driver mode details shown to customers on a live-location link (stored on this phone only). */
export interface DriverProfile {
  enabled: boolean;
  vehicle: string;
  plate: string;
  phone: string;
}

const KEY = 'jalango:driver-profile';
const EVENT = 'jalango:driver-profile-change';
const EMPTY: DriverProfile = { enabled: false, vehicle: '', plate: '', phone: '' };
let cache: { raw: string | null; value: DriverProfile } = { raw: null, value: EMPTY };

function read(): DriverProfile {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    /* ignore */
  }
  if (raw === cache.raw) return cache.value; // stable reference for useSyncExternalStore
  let value = EMPTY;
  try {
    value = { ...EMPTY, ...(raw ? (JSON.parse(raw) as Partial<DriverProfile>) : {}) };
  } catch {
    /* ignore */
  }
  cache = { raw, value };
  return value;
}

export function useDriverProfile(): [DriverProfile, (p: Partial<DriverProfile>) => void] {
  const profile = useSyncExternalStore(
    (cb) => {
      window.addEventListener(EVENT, cb);
      return () => window.removeEventListener(EVENT, cb);
    },
    read,
    () => EMPTY,
  );
  const update = useCallback((p: Partial<DriverProfile>) => {
    try {
      localStorage.setItem(KEY, JSON.stringify({ ...read(), ...p }));
    } catch {
      /* ignore */
    }
    window.dispatchEvent(new Event(EVENT));
  }, []);
  return [profile, update];
}

/** "wxy 1234" → "WXY 1234"; null when it can't be a plate (same rule as the database). */
export function normalizePlate(input: string): string | null {
  const p = input.toUpperCase().replace(/[^A-Z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
  return /^[A-Z0-9 ]{2,12}$/.test(p) ? p : null;
}

/** "012-345 6789" → "60123456789" (Malaysian numbers get the country code); null when invalid. */
export function normalizePhone(input: string): string | null {
  let d = input.replace(/[^\d+]/g, '');
  if (d.startsWith('+')) d = d.slice(1);
  if (d.startsWith('0')) d = `6${d}`;
  return /^[0-9]{8,15}$/.test(d) ? d : null;
}
