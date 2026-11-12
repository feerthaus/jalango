import { supabase } from './supabase';

const DEVICE_KEY = 'jalango:device-id';
const DAY_KEY = 'jalango:active-day';
let sending = false;

/** Today in Malaysia (YYYY-MM-DD). */
const todayMY = () => new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10);

/**
 * Count this device once a day for the admin statistics. The ID is random,
 * made on this phone, and never linked to an account, IP or location.
 */
export function pingActivity(): void {
  if (!supabase) return;
  try {
    const today = todayMY();
    if (sending || localStorage.getItem(DAY_KEY) === today) return;
    sending = true;
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(DEVICE_KEY, id);
    }
    const installed = window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    void supabase.rpc('ping_activity', { p_device: id, p_installed: Boolean(installed) }).then(({ error }) => {
      if (!error) localStorage.setItem(DAY_KEY, today);
      sending = false;
    }, () => {
      sending = false;
    });
  } catch {
    /* private mode / storage blocked: skip */
  }
}
