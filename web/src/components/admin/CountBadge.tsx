import { cn } from '@/lib/cn';
import { useT } from '@/lib/i18n';

/** Small red number, e.g. on a tab. Hidden at 0. */
export function CountBadge({ n, className }: { n: number; className?: string }) {
  const [t] = useT();
  if (!n) return null;
  return (
    <span aria-label={t(`${n} baru`, `${n} new`)} className={cn('inline-grid min-w-5 place-items-center rounded-full bg-red-600 px-1.5 text-[11px] font-bold leading-5 text-white tabular-nums', className)}>
      {n > 99 ? '99+' : n}
    </span>
  );
}
