import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  active?: boolean;
  size?: 'md' | 'lg';
  children: ReactNode;
}

/** High-contrast round control used on top of the map. */
export function IconButton({ label, active, size = 'md', className, children, ...rest }: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={cn(
        'pointer-events-auto grid place-items-center rounded-2xl shadow-float transition active:scale-95 disabled:opacity-50',
        size === 'lg' ? 'size-14' : 'size-11',
        active
          ? 'bg-jade-500 text-ink-950'
          : 'bg-white text-ink-800 hover:bg-ink-50 dark:bg-ink-800 dark:text-ink-50 dark:hover:bg-ink-700',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
