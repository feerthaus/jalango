import type { DocKind, OperatorKind, OperatorStatus } from '@/services/operatorService';

export const KIND_LABEL: Record<OperatorKind, string> = { homestay: 'Homestay / rumah sewa', car_rental: 'Kereta sewa', food: 'Restoran / warung / gerai' };

export const DOC_LABEL: Record<DocKind, string> = {
  ic: 'Kad pengenalan (IC) pemilik',
  ownership: 'Bukti pemilikan atau kebenaran (geran, bil utiliti, perjanjian sewa)',
  ssm: 'Sijil SSM',
  apad_licence: 'Lesen APAD kereta sewa pandu sendiri',
  insurance: 'Sijil insurans (meliputi kegunaan sewa)',
  other: 'Dokumen lain',
  premises: 'Gambar premis (kedai, warung atau gerai, nampak papan tanda jika ada)',
  pbt_licence: 'Lesen perniagaan PBT / majlis (jika ada)',
  food_handler: 'Sijil latihan pengendali makanan (jika ada)',
  halal_jakim: 'Sijil Halal JAKIM / JAIN (jika ada, untuk lencana Halal JAKIM)',
};

export const STATUS_LABEL: Record<OperatorStatus, { text: string; tone: string }> = {
  pending: { text: 'Menunggu semakan', tone: 'bg-amber-400/20 text-amber-800 dark:text-amber-200' },
  needs_info: { text: 'Perlu maklumat tambahan', tone: 'bg-sky-500/15 text-sky-800 dark:text-sky-200' },
  approved: { text: 'Disahkan', tone: 'bg-jade-500/15 text-jade-700 dark:text-jade-300' },
  rejected: { text: 'Ditolak', tone: 'bg-red-500/15 text-red-700 dark:text-red-300' },
  suspended: { text: 'Digantung', tone: 'bg-red-600 text-white' },
};

export const MY_STATES = [
  'Johor', 'Kedah', 'Kelantan', 'Melaka', 'Negeri Sembilan', 'Pahang', 'Perak', 'Perlis', 'Pulau Pinang', 'Sabah', 'Sarawak', 'Selangor', 'Terengganu',
  'WP Kuala Lumpur', 'WP Labuan', 'WP Putrajaya',
];
