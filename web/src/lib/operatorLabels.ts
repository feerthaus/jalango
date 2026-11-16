import type { Msg } from '@/lib/i18n';
import type { DocKind, OperatorKind, OperatorStatus } from '@/services/operatorService';

export const KIND_LABEL: Record<OperatorKind, Msg> = {
  homestay: { ms: 'Homestay / rumah sewa', en: 'Homestay / house for rent' },
  car_rental: { ms: 'Kereta sewa', en: 'Car rental' },
  food: { ms: 'Restoran / warung / gerai', en: 'Restaurant / warung / stall' },
};

export const DOC_LABEL: Record<DocKind, Msg> = {
  ic: { ms: 'Kad pengenalan (IC) pemilik', en: "Owner's identity card (IC)" },
  ownership: { ms: 'Bukti pemilikan atau kebenaran (geran, bil utiliti, perjanjian sewa)', en: 'Proof of ownership or permission (title, utility bill, tenancy agreement)' },
  ssm: { ms: 'Sijil SSM', en: 'SSM certificate' },
  apad_licence: { ms: 'Lesen APAD kereta sewa pandu sendiri', en: 'APAD self-drive car rental licence' },
  insurance: { ms: 'Sijil insurans (meliputi kegunaan sewa)', en: 'Insurance certificate (covering rental use)' },
  other: { ms: 'Dokumen lain', en: 'Other document' },
  premises: { ms: 'Gambar premis (kedai, warung atau gerai, nampak papan tanda jika ada)', en: 'Photo of the premises (shop, warung or stall, with the signboard if any)' },
  pbt_licence: { ms: 'Lesen perniagaan PBT / majlis (jika ada)', en: 'Local council (PBT) business licence (if any)' },
  food_handler: { ms: 'Sijil latihan pengendali makanan (jika ada)', en: 'Food handler training certificate (if any)' },
  halal_jakim: { ms: 'Sijil Halal JAKIM / JAIN (jika ada, untuk lencana Halal JAKIM)', en: 'JAKIM / JAIN halal certificate (if any, for the Halal JAKIM badge)' },
};

export const STATUS_LABEL: Record<OperatorStatus, { text: Msg; tone: string }> = {
  pending: { text: { ms: 'Menunggu semakan', en: 'Waiting for review' }, tone: 'bg-amber-400/20 text-amber-800 dark:text-amber-200' },
  needs_info: { text: { ms: 'Perlu maklumat tambahan', en: 'More information needed' }, tone: 'bg-sky-500/15 text-sky-800 dark:text-sky-200' },
  approved: { text: { ms: 'Disahkan', en: 'Verified' }, tone: 'bg-jade-500/15 text-jade-700 dark:text-jade-300' },
  rejected: { text: { ms: 'Ditolak', en: 'Rejected' }, tone: 'bg-red-500/15 text-red-700 dark:text-red-300' },
  suspended: { text: { ms: 'Digantung', en: 'Suspended' }, tone: 'bg-red-600 text-white' },
};

export const MY_STATES = [
  'Johor', 'Kedah', 'Kelantan', 'Melaka', 'Negeri Sembilan', 'Pahang', 'Perak', 'Perlis', 'Pulau Pinang', 'Sabah', 'Sarawak', 'Selangor', 'Terengganu',
  'WP Kuala Lumpur', 'WP Labuan', 'WP Putrajaya',
];
