import type { Coordinates } from '@/types';

/** Malaysian number for wa.me / tel: digits only, starting with 60. */
export function msisdn(phone: string): string {
  const d = phone.replace(/\D/g, '');
  return d.startsWith('60') ? d : d.startsWith('0') ? `6${d}` : d;
}

export interface EnquiryInput {
  kind: 'homestay' | 'car_rental';
  title: string;
  url: string;
  from?: string | null;
  to?: string | null;
  /** renter's own location, for car rental pickup / delivery */
  pickup?: Coordinates | null;
}

const fmt = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString('ms-MY', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

/** The WhatsApp message a renter sends: listing, dates and (for cars) where to meet. */
export function enquiryText(e: EnquiryInput): string {
  const lines = [`Salam, saya berminat dengan "${e.title}" (dari JalanGo).`];
  if (e.from) {
    const label = e.kind === 'car_rental' ? ['Ambil', 'Pulang'] : ['Daftar masuk', 'Daftar keluar'];
    lines.push(`${label[0]}: ${fmt(e.from)}${e.to ? `\n${label[1]}: ${fmt(e.to)}` : ''}`);
  }
  if (e.kind === 'car_rental' && e.pickup) {
    lines.push(`Lokasi saya untuk ambil/hantar kereta: https://maps.google.com/?q=${e.pickup.lat.toFixed(6)},${e.pickup.lng.toFixed(6)}`);
  }
  lines.push('Masih ada kosong?', e.url);
  return lines.join('\n');
}

export const whatsappUrl = (phone: string, text: string) => `https://wa.me/${msisdn(phone)}?text=${encodeURIComponent(text)}`;

/** Days from `from` (inclusive) to `to` (exclusive for homestay nights, inclusive for car days). */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/** True if any blocked day falls inside the stay / rental. */
export function overlapsBlocked(from: string, to: string | null, blocked: Set<string>, kind: 'homestay' | 'car_rental'): boolean {
  const end = to ?? from;
  const n = Math.max(0, daysBetween(from, end)) + (kind === 'car_rental' || !to ? 1 : 0);
  for (let i = 0; i < n; i++) {
    const d = new Date(Date.parse(`${from}T00:00:00Z`) + i * 86_400_000).toISOString().slice(0, 10);
    if (blocked.has(d)) return true;
  }
  return false;
}

/** Estimated total using the weekend price on Fri/Sat nights (homestay) or Sat/Sun days (car). */
export function estimateTotal(from: string, to: string, price: number, weekend: number | null, kind: 'homestay' | 'car_rental'): { units: number; total: number } {
  const n = Math.max(1, daysBetween(from, to));
  let total = 0;
  for (let i = 0; i < n; i++) {
    const dow = new Date(Date.parse(`${from}T00:00:00Z`) + i * 86_400_000).getUTCDay();
    const wknd = kind === 'homestay' ? dow === 5 || dow === 6 : dow === 0 || dow === 6;
    total += wknd && weekend ? weekend : price;
  }
  return { units: n, total };
}
