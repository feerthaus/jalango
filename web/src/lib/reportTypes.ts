import { Ban, Car, CarFront, Cctv, Construction, Siren, TrafficCone, TriangleAlert, Waves, type LucideIcon } from 'lucide-react';
import type { ReportType } from '@/types';

export interface ReportTypeMeta {
  type: ReportType;
  label: string;
  labelMs: string;
  icon: LucideIcon;
  /** Tailwind classes for chip/marker colour */
  tone: string;
}

export function reportMeta(type: ReportType): ReportTypeMeta {
  return REPORT_TYPES.find((t) => t.type === type) ?? REPORT_TYPES[3];
}

/** Must stay in sync with the `report_type` CHECK constraint in the SQL migration. */
export const REPORT_TYPES: ReportTypeMeta[] = [
  { type: 'accident', label: 'Accident', labelMs: 'Kemalangan', icon: CarFront, tone: 'bg-red-500 text-white' },
  { type: 'congestion', label: 'Traffic jam', labelMs: 'Kesesakan', icon: Car, tone: 'bg-orange-500 text-white' },
  { type: 'road_closure', label: 'Road closed', labelMs: 'Jalan ditutup', icon: Ban, tone: 'bg-rose-700 text-white' },
  { type: 'hazard', label: 'Hazard', labelMs: 'Bahaya', icon: TriangleAlert, tone: 'bg-amber-400 text-ink-950' },
  { type: 'flood', label: 'Flood', labelMs: 'Banjir', icon: Waves, tone: 'bg-sky-500 text-white' },
  { type: 'breakdown', label: 'Broken-down vehicle', labelMs: 'Kenderaan rosak', icon: TrafficCone, tone: 'bg-violet-500 text-white' },
  { type: 'construction', label: 'Roadworks', labelMs: 'Kerja jalan', icon: Construction, tone: 'bg-yellow-500 text-ink-950' },
  { type: 'police', label: 'Speed trap / police', labelMs: 'Speed trap polis', icon: Siren, tone: 'bg-blue-600 text-white' },
  { type: 'speed_camera', label: 'Speed camera (AES/AWAS)', labelMs: 'Kamera AWAS', icon: Cctv, tone: 'bg-slate-700 text-white' },
];

/** Report type name in the app language. */
export function typeLabel(meta: ReportTypeMeta, lang: 'ms' | 'en'): string {
  return lang === 'en' ? meta.label : meta.labelMs;
}
