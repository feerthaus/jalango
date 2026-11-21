import { classifyVisit } from '@/utils/attribution';
import { supabase } from './supabase';

const DEVICE_KEY = 'jalango:device-id';
const DAY_KEY = 'jalango:active-day';
const ATTRIBUTION_KEY = 'jalango:attribution-sent';
const NO_STATS_KEY = 'jalango:no-stats';
const SIGNUP_KEY = 'jalango:growth-signup:';
let sending = false;

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* storage blocked */
  }
}

/**
 * The very first page of this visit, read when the app loads (before any page
 * tidies its URL, e.g. the map removing ?tempat= or ?convoy=). A device that
 * already had an ID before growth tracking existed is "known": its first visit
 * was long ago, so no channel is recorded for it.
 */
const LANDING =
  typeof window === 'undefined'
    ? null
    : { search: window.location.search, path: window.location.pathname, referrer: document.referrer, known: read(DEVICE_KEY) !== null };

/** "Jangan kira peranti ini": Profil switch; skips the daily count and growth tracking. */
export function statsOptedOut(): boolean {
  return read(NO_STATS_KEY) === '1';
}
export function setStatsOptOut(out: boolean) {
  write(NO_STATS_KEY, out ? '1' : null);
}

/** Today in Malaysia (YYYY-MM-DD). */
const todayMY = () => new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10);

/** This phone's random ID (made here, never linked to an account). Null if storage is blocked. */
export function deviceId(): string | null {
  try {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}

/**
 * Count this device once a day for the admin statistics. The ID is random,
 * made on this phone, and never linked to an account, IP or location.
 */
export function pingActivity(): void {
  if (!supabase || statsOptedOut()) return;
  recordFirstVisit();
  try {
    const today = todayMY();
    if (sending || localStorage.getItem(DAY_KEY) === today) return;
    sending = true;
    const id = deviceId();
    if (!id) return;
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

/**
 * Once per new device: where its first visit came from (channel, campaign,
 * referring site, first page). Only for devices first seen now; never again.
 */
function recordFirstVisit(): void {
  if (!supabase || !LANDING || LANDING.known || read(ATTRIBUTION_KEY)) return;
  const id = deviceId();
  if (!id) return;
  const a = classifyVisit({ ...LANDING, ownHost: window.location.host });
  write(ATTRIBUTION_KEY, '1'); // one try: a failure just leaves this device uncounted
  void supabase
    .rpc('record_attribution', { p_device: id, p_source: a.source, p_medium: a.medium, p_campaign: a.campaign, p_ref_domain: a.refDomain, p_landing: a.landing })
    .then(undefined, () => undefined);
}

/**
 * A new account or business: counted once per channel on the server (only if
 * it was created in the last 24 hours). The device ID just picks the channel;
 * no link between device and account is stored.
 */
export function recordConversion(event: 'signup' | 'business_registered', userId?: string): void {
  if (!supabase || statsOptedOut()) return;
  if (event === 'signup' && userId) {
    if (read(SIGNUP_KEY + userId)) return; // asked already on this phone
    write(SIGNUP_KEY + userId, '1');
  }
  void supabase.rpc('record_conversion', { p_device: deviceId(), p_event: event }).then(undefined, () => undefined);
}
