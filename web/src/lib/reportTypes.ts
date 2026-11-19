import { Ban, Car, CarFront, Cctv, Construction, ShieldAlert, Siren, TrafficCone, TriangleAlert, Waves, type LucideIcon } from 'lucide-react';
import type { ReportType, TrafficReport } from '@/types';

export interface ReportTypeMeta {
  type: ReportType;
  label: string;
  labelMs: string;
  icon: LucideIcon;
  /** Tailwind classes for chip/marker colour */
  tone: string;
}

export function reportMeta(type: ReportType): ReportTypeMeta {
  return REPORT_TYPES.find((t) => t.type === type) ?? REPORT_TYPES.find((t) => t.type === 'hazard')!;
}

/** Report name, with a flood's passability: "Banjir · tak boleh lalu" / "Flood · impassable". */
export function reportTitle(r: Pick<TrafficReport, 'report_type' | 'flood_passable'>, lang: 'ms' | 'en'): string {
  const meta = reportMeta(r.report_type);
  const name = lang === 'ms' ? meta.labelMs : meta.label;
  if (r.report_type !== 'flood' || typeof r.flood_passable !== 'boolean') return name;
  if (lang === 'ms') return `${name} · ${r.flood_passable ? 'boleh lalu perlahan' : 'tak boleh lalu'}`;
  return `${name} · ${r.flood_passable ? 'passable with care' : 'impassable'}`;
}

/** Floods reported as impassable: routes go around these points. */
export const isImpassableFlood = (r: Pick<TrafficReport, 'report_type' | 'flood_passable' | 'status'>) => r.report_type === 'flood' && r.flood_passable === false && r.status === 'active';

/** Must stay in sync with the `report_type` CHECK constraint in the SQL migration. */
export const REPORT_TYPES: ReportTypeMeta[] = [
  { type: 'accident', label: 'Accident', labelMs: 'Kemalangan', icon: CarFront, tone: 'bg-red-500 text-white' },
  { type: 'congestion', label: 'Traffic jam', labelMs: 'Kesesakan', icon: Car, tone: 'bg-orange-500 text-white' },
  { type: 'police', label: 'Police', labelMs: 'Polis', icon: Siren, tone: 'bg-blue-600 text-white' },
  { type: 'roadblock', label: 'Police roadblock', labelMs: 'Sekatan jalan (SJR)', icon: ShieldAlert, tone: 'bg-indigo-800 text-white' },
  { type: 'road_closure', label: 'Road closed', labelMs: 'Jalan ditutup', icon: Ban, tone: 'bg-rose-700 text-white' },
  { type: 'hazard', label: 'Hazard', labelMs: 'Bahaya', icon: TriangleAlert, tone: 'bg-amber-400 text-ink-950' },
  { type: 'flood', label: 'Flood', labelMs: 'Banjir', icon: Waves, tone: 'bg-sky-500 text-white' },
  { type: 'breakdown', label: 'Broken-down vehicle', labelMs: 'Kenderaan rosak', icon: TrafficCone, tone: 'bg-violet-500 text-white' },
  { type: 'construction', label: 'Roadworks', labelMs: 'Kerja jalan', icon: Construction, tone: 'bg-yellow-500 text-ink-950' },
  { type: 'speed_camera', label: 'Speed camera (AES/AWAS)', labelMs: 'Kamera AWAS', icon: Cctv, tone: 'bg-slate-700 text-white' },
];

/** Report type name in the app language. */
export function typeLabel(meta: ReportTypeMeta, lang: 'ms' | 'en'): string {
  return lang === 'en' ? meta.label : meta.labelMs;
}
