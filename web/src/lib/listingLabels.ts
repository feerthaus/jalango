import type { ListingStatus, PhotoStatus } from '@/services/listingService';

export const LISTING_STATUS: Record<ListingStatus, { text: string; tone: string }> = {
  draft: { text: 'Draf', tone: 'bg-ink-200 text-ink-700 dark:bg-ink-700 dark:text-ink-200' },
  pending: { text: 'Menunggu semakan', tone: 'bg-amber-400/20 text-amber-800 dark:text-amber-200' },
  live: { text: 'Disiarkan', tone: 'bg-jade-500/15 text-jade-700 dark:text-jade-300' },
  paused: { text: 'Dijeda', tone: 'bg-sky-500/15 text-sky-800 dark:text-sky-200' },
  rejected: { text: 'Ditolak', tone: 'bg-red-500/15 text-red-700 dark:text-red-300' },
};

export const PHOTO_STATUS: Record<PhotoStatus, { text: string; tone: string }> = {
  pending: { text: 'Menunggu semakan', tone: 'bg-amber-400 text-ink-950' },
  approved: { text: 'Diluluskan', tone: 'bg-jade-500 text-white' },
  rejected: { text: 'Ditolak', tone: 'bg-red-600 text-white' },
};

export const AMENITIES: { id: string; label: string }[] = [
  { id: 'wifi', label: 'Wi-Fi' },
  { id: 'aircond', label: 'Aircond' },
  { id: 'parking', label: 'Parkir' },
  { id: 'kitchen', label: 'Dapur' },
  { id: 'washer', label: 'Mesin basuh' },
  { id: 'tv', label: 'TV' },
  { id: 'water_heater', label: 'Pemanas air' },
  { id: 'pool', label: 'Kolam renang' },
  { id: 'bbq', label: 'BBQ' },
  { id: 'prayer', label: 'Ruang solat / surau berdekatan' },
  { id: 'family', label: 'Mesra keluarga' },
  { id: 'muslim', label: 'Mesra Muslim' },
];

export const HOMESTAY_TYPES = [
  { id: 'house', label: 'Rumah' },
  { id: 'apartment', label: 'Apartmen' },
  { id: 'room', label: 'Bilik' },
  { id: 'chalet', label: 'Chalet' },
] as const;

export const FUELS = [
  { id: 'petrol', label: 'Petrol' },
  { id: 'diesel', label: 'Diesel' },
  { id: 'hybrid', label: 'Hibrid' },
  { id: 'ev', label: 'Elektrik' },
] as const;

export const rm = (n: number | null | undefined) => (n === null || n === undefined ? '' : `RM${Number(n).toLocaleString('ms-MY', { maximumFractionDigits: 2 })}`);

export const FOOD_TYPES: { id: import('@/services/listingService').FoodType; label: string }[] = [
  { id: 'restoran', label: 'Restoran' },
  { id: 'warung', label: 'Warung' },
  { id: 'gerai', label: 'Gerai' },
  { id: 'kafe', label: 'Kafe' },
  { id: 'food_truck', label: 'Food truck' },
];

export const FOOD_SERVICES: { id: 'dine_in' | 'takeaway' | 'delivery'; label: string }[] = [
  { id: 'dine_in', label: 'Makan di kedai' },
  { id: 'takeaway', label: 'Tapau' },
  { id: 'delivery', label: 'Hantar (delivery)' },
];

/** What a food business may say about halal. Never the word "halal" without a checked JAKIM certificate. */
export const HALAL_LABEL: Record<import('@/services/listingService').HalalClaim, string> = {
  jakim: 'Halal JAKIM',
  muslim_owner: 'Pemilik Muslim',
  no_pork: 'Tiada daging babi',
};

export const DAYS_MS = ['Ahad', 'Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Sabtu'];
