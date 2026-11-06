import { useId } from 'react';
import { cn } from '@/lib/cn';

/** JalanGo mark: a road shaped like a "J" heading into a navigation arrow ("Go"). */
export function LogoMark({ className, title = 'JalanGo' }: { className?: string; title?: string }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg viewBox="0 0 512 512" className={cn('shrink-0', className)} role="img" aria-label={title}>
      <defs>
        <linearGradient id={`${id}bg`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#16213a" />
          <stop offset="1" stopColor="#0b1220" />
        </linearGradient>
        <linearGradient id={`${id}go`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5cf0c4" />
          <stop offset="1" stopColor="#14c493" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="116" fill={`url(#${id}bg)`} />
      <path d="M300 210 V296 C300 376 248 420 186 420 C150 420 124 406 106 386" fill="none" stroke="#3b4b70" strokeWidth="100" strokeLinecap="round" />
      <path
        d="M300 210 V296 C300 376 248 420 186 420 C150 420 124 406 106 386"
        fill="none"
        stroke="#e8edf5"
        strokeWidth="12"
        strokeLinecap="round"
        strokeDasharray="28 28"
        strokeDashoffset="8"
        opacity=".9"
      />
      <path d="M300 52 L400 236 L300 192 L200 236 Z" fill={`url(#${id}go)`} stroke="#0b1220" strokeWidth="14" strokeLinejoin="round" />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <LogoMark className="size-10" />
      <span className="text-xl font-black tracking-tight">
        Jalan<span className="text-jade-500">Go</span>
      </span>
    </span>
  );
}
