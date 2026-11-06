import { BedDouble, Coffee, MapPin, Mountain, Camera, UtensilsCrossed, type LucideIcon } from 'lucide-react';
import type { CommunityCategory } from '@/types';

export const COMMUNITY_CATEGORIES: { id: CommunityCategory; label: string; labelMs: string; icon: LucideIcon; tone: string }[] = [
  { id: 'food', label: 'Food', labelMs: 'Makan', icon: UtensilsCrossed, tone: 'bg-orange-500 text-white' },
  { id: 'cafe', label: 'Café', labelMs: 'Kafe', icon: Coffee, tone: 'bg-amber-700 text-white' },
  { id: 'attraction', label: 'Attraction', labelMs: 'Tarikan', icon: Camera, tone: 'bg-pink-500 text-white' },
  { id: 'nature', label: 'Nature', labelMs: 'Alam', icon: Mountain, tone: 'bg-emerald-600 text-white' },
  { id: 'stay', label: 'Stay', labelMs: 'Penginapan', icon: BedDouble, tone: 'bg-indigo-500 text-white' },
  { id: 'other', label: 'Other', labelMs: 'Lain-lain', icon: MapPin, tone: 'bg-ink-500 text-white' },
];

export const categoryMeta = (id: CommunityCategory) => COMMUNITY_CATEGORIES.find((c) => c.id === id) ?? COMMUNITY_CATEGORIES[5];
