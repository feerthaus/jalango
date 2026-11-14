import { BedDouble, Camera, Coffee, Fuel, ParkingSquare, Utensils, Zap, type LucideIcon } from 'lucide-react';
import type { AlongCategory } from '@/services/geocodingService';
import type { CommunityCategory } from '@/types';

export interface AlongCategoryMeta {
  id: AlongCategory;
  label: string;
  icon: LucideIcon;
  /** pin colour on the map */
  color: string;
  /** how far off the route line a place may be */
  maxOffsetM: number;
  community: CommunityCategory[];
  /** inline SVG path(s) for the map pin (24×24, stroke) */
  glyph: string;
}

export const ALONG_CATEGORIES: AlongCategoryMeta[] = [
  { id: 'food', label: 'Makan', icon: Utensils, color: '#ea580c', maxOffsetM: 2500, community: ['food'], glyph: '<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2M7 2v20M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>' },
  { id: 'cafe', label: 'Kafe', icon: Coffee, color: '#a16207', maxOffsetM: 2500, community: ['cafe'], glyph: '<path d="M10 2v2M14 2v2M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1M6 2v2"/>' },
  { id: 'stay', label: 'Penginapan', icon: BedDouble, color: '#4f46e5', maxOffsetM: 5000, community: ['stay'], glyph: '<path d="M2 4v16M2 8h18a2 2 0 0 1 2 2v10M2 17h20M6 8v9"/>' },
  { id: 'attraction', label: 'Menarik', icon: Camera, color: '#db2777', maxOffsetM: 8000, community: ['attraction', 'nature'], glyph: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>' },
  { id: 'rnr', label: 'R&R', icon: ParkingSquare, color: '#2563eb', maxOffsetM: 800, community: [], glyph: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 17V7h4a3 3 0 0 1 0 6H9"/>' },
  { id: 'petrol', label: 'Minyak', icon: Fuel, color: '#dc2626', maxOffsetM: 1500, community: [], glyph: '<path d="M3 22h12M4 9h10M14 22V4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v18M14 13h2a2 2 0 0 1 2 2v2a2 2 0 0 0 2 2 2 2 0 0 0 2-2V9.83a2 2 0 0 0-.59-1.42L18 5"/>' },
  { id: 'ev', label: 'EV', icon: Zap, color: '#16a34a', maxOffsetM: 3000, community: [], glyph: '<path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/>' },
];

export const alongMeta = (id: AlongCategory) => ALONG_CATEGORIES.find((c) => c.id === id)!;
