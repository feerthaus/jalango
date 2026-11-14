import { Bell, ChevronRight, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useAuth } from '@/contexts/AuthContext';
import { useAdminCounts } from '@/hooks/useAdminCounts';
import { cn } from '@/lib/cn';
import { fetchAdminStatus } from '@/services/adminAuth';
import { fetchAdminStats, type AdminStats } from '@/services/adminStats';
import { CountBadge } from './CountBadge';

const QUEUES = [
  { key: 'operators', tab: 'operators', label: 'Operator' },
  { key: 'listings', tab: 'listings', label: 'Listing' },
  { key: 'flags', tab: 'flags', label: 'Laporan' },
  { key: 'photos', tab: 'photos', label: 'Gambar' },
  { key: 'feedback', tab: 'feedback', label: 'Mesej' },
] as const;

/**
 * Admins only: today's numbers and what is waiting for review, right in
 * Profil, each one tap from its admin tab. Hidden for everyone else.
 */
export function AdminCard() {
  const { user } = useAuth();
  const counts = useAdminCounts();
  const [admin, setAdmin] = useState(false);
  const [stats, setStats] = useState<AdminStats | null>(null);

  useEffect(() => {
    if (!user) return setAdmin(false);
    void fetchAdminStatus().then((s) => setAdmin(s.admin));
  }, [user]);

  // Numbers need the 2FA session (same as counts)
  const verified = Boolean(counts);
  useEffect(() => {
    if (!verified) return;
    let alive = true;
    const load = () => {
      if (document.visibilityState === 'hidden') return;
      fetchAdminStats().then((s) => alive && setStats(s), () => undefined);
    };
    load();
    document.addEventListener('visibilitychange', load);
    return () => {
      alive = false;
      document.removeEventListener('visibilitychange', load);
    };
  }, [verified]);

  if (!admin) return null;

  if (!counts) {
    return (
      <Link to="/admin" className="mt-3 flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-ink-200 dark:bg-ink-900 dark:ring-ink-800">
        <ShieldCheck className="size-6 shrink-0 text-red-500" />
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">Admin</span>
          <span className="block text-xs text-ink-500">Sahkan kod 2FA untuk lihat statistik dan notifikasi.</span>
        </span>
        <ChevronRight className="size-5 text-ink-400" />
      </Link>
    );
  }

  const newToday = stats?.daily.at(-1)?.new ?? 0;
  const tiles = [
    { label: 'Aktif hari ini', value: stats?.active_today, sub: stats ? `+${newToday} baru` : '' },
    { label: 'Aktif 7 hari', value: stats?.active_7d, sub: stats ? `${stats.installed_7d} dipasang` : '' },
    { label: 'Akaun', value: stats?.accounts_total, sub: stats ? `+${stats.accounts_7d} minggu ini` : '' },
  ];

  return (
    <section aria-label="Admin" className="mt-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-red-500/30 dark:bg-ink-900">
      <div className="mb-3 flex items-center gap-2">
        <ShieldCheck className="size-5 text-red-500" />
        <p className="flex-1 font-bold">Admin</p>
        {counts.total > 0 && (
          <span className="relative grid size-8 place-items-center" aria-label={`${counts.total} perkara menunggu semakan`}>
            <Bell className="size-5" />
            <CountBadge n={counts.total} className="absolute -right-1 -top-1" />
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2">
        {tiles.map((t) => (
          <Link key={t.label} to="/admin" className="rounded-xl bg-ink-100 p-2.5 dark:bg-ink-800">
            <span className="block text-[11px] text-ink-500">{t.label}</span>
            <span className="block text-xl font-black tabular-nums">{t.value ?? '–'}</span>
            <span className="block truncate text-[10px] text-ink-500">{t.sub}</span>
          </Link>
        ))}
      </div>

      <p className="mb-1.5 mt-3 text-xs font-semibold text-ink-500">{counts.total > 0 ? `${counts.total} menunggu semakan` : 'Tiada yang menunggu semakan'}</p>
      <div className="flex flex-wrap gap-1.5">
        {QUEUES.map((q) => {
          const n = counts[q.key];
          return (
            <Link
              key={q.key}
              to={`/admin?tab=${q.tab}`}
              className={cn('flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold', n > 0 ? 'bg-red-500/10 text-red-700 dark:text-red-300' : 'bg-ink-100 text-ink-500 dark:bg-ink-800')}
            >
              {q.label} {n > 0 ? <CountBadge n={n} /> : <span className="tabular-nums">0</span>}
            </Link>
          );
        })}
      </div>

      <Link to="/admin" className="mt-3 flex items-center justify-center gap-1 rounded-xl bg-ink-100 py-2.5 text-sm font-semibold dark:bg-ink-800">
        Buka halaman Admin <ChevronRight className="size-4" />
      </Link>
    </section>
  );
}
