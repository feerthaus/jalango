import type { ReactNode } from 'react';

/**
 * Container for non-map tabs. Full screen on mobile (above the bottom nav),
 * a side panel on desktop so the map stays visible.
 */
export function PagePanel({ title, subtitle, action, children }: { title: string; subtitle?: ReactNode; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="pointer-events-auto absolute inset-x-0 top-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] flex animate-slide-up flex-col bg-ink-50 md:inset-y-0 md:bottom-0 md:left-0 md:w-[420px] md:border-r md:border-ink-200 md:shadow-float dark:bg-ink-950 md:dark:border-ink-800">
      <header className="safe-top flex items-end justify-between gap-3 px-5 pb-3 pt-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {subtitle && <div className="mt-0.5 text-sm text-ink-500 dark:text-ink-300">{subtitle}</div>}
        </div>
        {action}
      </header>
      <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-6">{children}</div>
    </section>
  );
}
