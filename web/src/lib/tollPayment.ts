import { useCallback, useSyncExternalStore } from 'react';

export type TollPayment = 'rfid' | 'tng' | 'smarttag' | 'card';
const KEY = 'jalango:toll-payment';
const EVENT = 'jalango:toll-payment-change';

export const TOLL_PAYMENTS: { id: TollPayment; ms: string; en: string }[] = [
  { id: 'rfid', ms: 'RFID', en: 'RFID' },
  { id: 'tng', ms: "Kad Touch 'n Go", en: "Touch 'n Go card" },
  { id: 'smarttag', ms: 'SmartTAG', en: 'SmartTAG' },
  { id: 'card', ms: 'Kad debit/kredit', en: 'Debit/credit card' },
];

function read(): TollPayment | null {
  try {
    const v = localStorage.getItem(KEY);
    return TOLL_PAYMENTS.some((p) => p.id === v) ? (v as TollPayment) : null;
  } catch {
    return null;
  }
}
function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener('storage', cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener('storage', cb);
  };
}

/** How the driver pays tolls (Profile → Cara bayar tol). Kept on this device. */
export function useTollPayment(): [TollPayment | null, (p: TollPayment | null) => void] {
  const value = useSyncExternalStore(subscribe, read, () => null);
  const set = useCallback((p: TollPayment | null) => {
    try {
      if (p) localStorage.setItem(KEY, p);
      else localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
    window.dispatchEvent(new Event(EVENT));
  }, []);
  return [value, set];
}
