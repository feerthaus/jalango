import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpLeft,
  ArrowUpRight,
  CornerUpLeft,
  CornerUpRight,
  Flag,
  Merge,
  Navigation,
  RotateCcw,
  RotateCw,
  Split,
  type LucideIcon,
} from 'lucide-react';
import type { RouteStep } from '@/types';

export function maneuverIcon(m: RouteStep['maneuver']): LucideIcon {
  const { type, modifier } = m;
  if (type === 'arrive') return Flag;
  if (type === 'depart') return Navigation;
  if (type === 'roundabout' || type === 'rotary' || type === 'roundabout turn') return modifier?.includes('left') ? RotateCcw : RotateCw;
  if (type === 'merge') return Merge;
  if (type === 'fork') return Split;
  switch (modifier) {
    case 'uturn':
      return RotateCcw;
    case 'sharp left':
    case 'left':
      return type === 'turn' || type === 'end of road' ? CornerUpLeft : ArrowLeft;
    case 'sharp right':
    case 'right':
      return type === 'turn' || type === 'end of road' ? CornerUpRight : ArrowRight;
    case 'slight left':
      return ArrowUpLeft;
    case 'slight right':
      return ArrowUpRight;
    default:
      return ArrowUp;
  }
}

export function ManeuverIcon({ step, className }: { step: RouteStep; className?: string }) {
  const Icon = maneuverIcon(step.maneuver);
  return <Icon className={className} aria-hidden />;
}
