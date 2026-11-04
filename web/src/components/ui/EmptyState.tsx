import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

export function EmptyState({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      <div className="mb-3 grid size-14 place-items-center rounded-2xl bg-ink-100 text-ink-400 dark:bg-ink-800 dark:text-ink-300">
        <Icon className="size-7" />
      </div>
      <p className="font-semibold">{title}</p>
      {children && <div className="mt-1 max-w-xs text-sm text-ink-500 dark:text-ink-300">{children}</div>}
    </div>
  );
}
