import type { Msg } from '@/lib/i18n';
import type { FoodType, HalalClaim, ListingStatus, PhotoStatus } from '@/services/listingService';

/* All labels are Msg ({ ms, en, … }): render them with t(label). */

export const LISTING_STATUS: Record<ListingStatus, { text: Msg; tone: string }> = {
  draft: { text: { ms: 'Draf', en: 'Draft' }, tone: 'bg-ink-200 text-ink-700 dark:bg-ink-700 dark:text-ink-200' },
  pending: { text: { ms: 'Menunggu semakan', en: 'Waiting for review' }, tone: 'bg-amber-400/20 text-amber-800 dark:text-amber-200' },
  live: { text: { ms: 'Disiarkan', en: 'Published' }, tone: 'bg-jade-500/15 text-jade-700 dark:text-jade-300' },
  paused: { text: { ms: 'Dijeda', en: 'Paused' }, tone: 'bg-sky-500/15 text-sky-800 dark:text-sky-200' },
  rejected: { text: { ms: 'Ditolak', en: 'Rejected' }, tone: 'bg-red-500/15 text-red-700 dark:text-red-300' },
};

export const PHOTO_STATUS: Record<PhotoStatus, { text: Msg; tone: string }> = {
  pending: { text: { ms: 'Menunggu semakan', en: 'Waiting for review' }, tone: 'bg-amber-400 text-ink-950' },
  approved: { text: { ms: 'Diluluskan', en: 'Approved' }, tone: 'bg-jade-500 text-white' },
  rejected: { text: { ms: 'Ditolak', en: 'Rejected' }, tone: 'bg-red-600 text-white' },
};

export const AMENITIES: { id: string; label: Msg }[] = [
  { id: 'wifi', label: { ms: 'Wi-Fi', en: 'Wi-Fi' } },
  { id: 'aircond', label: { ms: 'Aircond', en: 'Air-conditioning' } },
  { id: 'parking', label: { ms: 'Parkir', en: 'Parking' } },
  { id: 'kitchen', label: { ms: 'Dapur', en: 'Kitchen' } },
  { id: 'washer', label: { ms: 'Mesin basuh', en: 'Washing machine' } },
  { id: 'tv', label: { ms: 'TV', en: 'TV' } },
  { id: 'water_heater', label: { ms: 'Pemanas air', en: 'Water heater' } },
  { id: 'pool', label: { ms: 'Kolam renang', en: 'Swimming pool' } },
  { id: 'bbq', label: { ms: 'BBQ', en: 'BBQ' } },
  { id: 'prayer', label: { ms: 'Ruang solat / surau berdekatan', en: 'Prayer space / surau nearby' } },
  { id: 'family', label: { ms: 'Mesra keluarga', en: 'Family-friendly' } },
  { id: 'muslim', label: { ms: 'Mesra Muslim', en: 'Muslim-friendly' } },
];

export const HOMESTAY_TYPES: { id: 'house' | 'apartment' | 'room' | 'chalet'; label: Msg }[] = [
  { id: 'house', label: { ms: 'Rumah', en: 'House' } },
  { id: 'apartment', label: { ms: 'Apartmen', en: 'Apartment' } },
  { id: 'room', label: { ms: 'Bilik', en: 'Room' } },
  { id: 'chalet', label: { ms: 'Chalet', en: 'Chalet' } },
];

export const FUELS: { id: 'petrol' | 'diesel' | 'hybrid' | 'ev'; label: Msg }[] = [
  { id: 'petrol', label: { ms: 'Petrol', en: 'Petrol' } },
  { id: 'diesel', label: { ms: 'Diesel', en: 'Diesel' } },
  { id: 'hybrid', label: { ms: 'Hibrid', en: 'Hybrid' } },
  { id: 'ev', label: { ms: 'Elektrik', en: 'Electric' } },
];

export const rm = (n: number | null | undefined) => (n === null || n === undefined ? '' : `RM${Number(n).toLocaleString('ms-MY', { maximumFractionDigits: 2 })}`);

export const FOOD_TYPES: { id: FoodType; label: Msg }[] = [
  { id: 'restoran', label: { ms: 'Restoran', en: 'Restaurant' } },
  { id: 'warung', label: { ms: 'Warung', en: 'Warung' } },
  { id: 'gerai', label: { ms: 'Gerai', en: 'Stall' } },
  { id: 'kafe', label: { ms: 'Kafe', en: 'Café' } },
  { id: 'food_truck', label: { ms: 'Food truck', en: 'Food truck' } },
];

export const FOOD_SERVICES: { id: 'dine_in' | 'takeaway' | 'delivery'; label: Msg }[] = [
  { id: 'dine_in', label: { ms: 'Makan di kedai', en: 'Dine in' } },
  { id: 'takeaway', label: { ms: 'Tapau', en: 'Takeaway' } },
  { id: 'delivery', label: { ms: 'Hantar (delivery)', en: 'Delivery' } },
];

/** What a food business may say about halal. Never the word "halal" without a checked JAKIM certificate. */
export const HALAL_LABEL: Record<HalalClaim, Msg> = {
  jakim: { ms: 'Halal JAKIM', en: 'Halal JAKIM' },
  muslim_owner: { ms: 'Pemilik Muslim', en: 'Muslim owner' },
  no_pork: { ms: 'Tiada daging babi', en: 'No pork' },
};

/** Day names, Sunday first (Date#getDay order). */
export const DAYS: Msg[] = [
  { ms: 'Ahad', en: 'Sunday' },
  { ms: 'Isnin', en: 'Monday' },
  { ms: 'Selasa', en: 'Tuesday' },
  { ms: 'Rabu', en: 'Wednesday' },
  { ms: 'Khamis', en: 'Thursday' },
  { ms: 'Jumaat', en: 'Friday' },
  { ms: 'Sabtu', en: 'Saturday' },
];
