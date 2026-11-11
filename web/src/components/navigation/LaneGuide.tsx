import { ArrowUp, ArrowUpLeft, ArrowUpRight, CornerUpLeft, CornerUpRight, Undo2, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { RouteStep } from '@/types';

const ICONS: Record<string, LucideIcon> = {
  straight: ArrowUp,
  'slight left': ArrowUpLeft,
  'slight right': ArrowUpRight,
  left: CornerUpLeft,
  'sharp left': CornerUpLeft,
  right: CornerUpRight,
  'sharp right': CornerUpRight,
  uturn: Undo2,
};

/** Which arrow to draw for a lane: the one matching our maneuver if the lane has several. */
export function laneArrow(indications: string[], modifier?: string): string {
  if (modifier && indications.includes(modifier)) return modifier;
  return indications[0] ?? 'straight';
}

/** Lane data worth showing: 2+ lanes and at least one to use. */
export const hasLanes = (step: RouteStep) => Boolean(step.lanes && step.lanes.length >= 2 && step.lanes.some((l) => l.valid));

/** "Use these lanes" strip under the maneuver banner. */
export function LaneGuide({ step }: { step: RouteStep }) {
  if (!hasLanes(step)) return null;
  const lanes = step.lanes!;
  return (
    <div className="flex items-center justify-center gap-1 border-t border-white/10 px-4 py-2" aria-label={`Lanes: use ${lanes.filter((l) => l.valid).length} of ${lanes.length}`}>
      {lanes.map((lane, i) => {
        const Icon = ICONS[laneArrow(lane.indications, step.maneuver.modifier)] ?? ArrowUp;
        return (
          <span key={i} className={cn('grid h-9 w-8 place-items-center rounded-md', lane.valid ? 'bg-white/10 text-white' : 'text-white/25')}>
            <Icon className="size-6" strokeWidth={lane.valid ? 2.6 : 2} />
          </span>
        );
      })}
    </div>
  );
}
