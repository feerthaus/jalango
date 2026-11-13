import { cn } from '@/lib/cn';
import { parseShields, type ShieldKind } from '@/utils/roadShields';

const STYLE: Record<ShieldKind, string> = {
  // Malaysian expressway signs: yellow route badge
  expressway: 'bg-amber-400 text-ink-950 ring-ink-950/80',
  federal: 'bg-white text-ink-950 ring-ink-950/80',
  state: 'bg-white text-ink-950 ring-ink-950/80',
  other: 'bg-ink-700 text-white ring-white/30',
};

/** Route numbers as small sign-style badges (E1, E2, J200…) plus a motorway exit number. */
export function RoadShields({ roadRef, exits, className }: { roadRef?: string; exits?: string; className?: string }) {
  const shields = parseShields(roadRef);
  const exit = exits?.split(/[;,]/)[0]?.trim();
  if (!shields.length && !exit) return null;
  return (
    <span className={cn('inline-flex flex-wrap items-center gap-1 align-middle', className)}>
      {exit && <span className="rounded bg-jade-600 px-1.5 py-px text-[11px] font-bold text-white ring-1 ring-white/40">Exit {exit}</span>}
      {shields.map((s) => (
        <span key={s.text} className={cn('rounded-[5px] px-1.5 py-px text-[11px] font-black leading-tight ring-1', STYLE[s.kind])} aria-label={`Laluan ${s.text}`}>
          {s.text}
        </span>
      ))}
    </span>
  );
}
