import { Compass, Map, Megaphone, Star, UserRound, type LucideIcon } from 'lucide-react';
import { NavLink } from 'react-router';
import { LogoMark, Wordmark } from '@/components/brand/LogoMark';
import { CountBadge } from '@/components/admin/CountBadge';
import { useAdminCounts } from '@/hooks/useAdminCounts';
import { cn } from '@/lib/cn';
import { useT } from '@/lib/i18n';

const ITEMS: { to: string; label: [ms: string, en: string]; icon: LucideIcon }[] = [
  { to: '/', label: ['Peta', 'Map'], icon: Map },
  { to: '/explore', label: ['Teroka', 'Explore'], icon: Compass },
  { to: '/reports', label: ['Laporan', 'Reports'], icon: Megaphone },
  { to: '/saved', label: ['Simpanan', 'Saved'], icon: Star },
  { to: '/profile', label: ['Profil', 'Profile'], icon: UserRound },
];

/** Bottom tab bar on mobile, left rail on desktop. */
export function BottomNav() {
  const [t] = useT();
  const admin = useAdminCounts();
  return (
    <nav
      aria-label="Main"
      className="safe-bottom absolute inset-x-0 bottom-0 z-30 border-t border-ink-200 bg-white/95 backdrop-blur-md md:inset-y-0 md:right-auto md:w-20 md:border-t-0 md:border-r md:pb-0 dark:border-ink-800 dark:bg-ink-950/95"
    >
      <div className="hidden h-20 items-center justify-center md:flex">
        <Logo />
      </div>
      <ul className="flex h-16 md:h-auto md:flex-col md:gap-1 md:px-2">
        {ITEMS.map(({ to, label, icon: Icon }) => (
          <li key={to} className="flex-1 md:flex-none">
            <NavLink
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                cn(
                  'flex h-full flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition md:h-16 md:rounded-2xl',
                  isActive ? 'text-jade-600 dark:text-jade-400' : 'text-ink-400 hover:text-ink-700 dark:hover:text-ink-200',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span className={cn('relative grid h-7 w-12 place-items-center rounded-full transition', isActive && 'bg-jade-500/15')}>
                    <Icon className="size-5" strokeWidth={isActive ? 2.5 : 2} />
                    {to === '/profile' && admin && admin.total > 0 && <CountBadge n={admin.total} className="absolute -right-0.5 -top-1.5" />}
                  </span>
                  {t(label[0], label[1])}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Kept for existing imports: mark (+ optional wordmark). */
export function Logo({ withText = false }: { withText?: boolean }) {
  return withText ? <Wordmark /> : <LogoMark className="size-10" />;
}
