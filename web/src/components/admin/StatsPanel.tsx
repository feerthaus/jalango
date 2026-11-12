import { Loader2, RefreshCw, Table2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/cn';
import { fetchAdminStats, type AdminStats, type DailyStat } from '@/services/adminStats';

const dayLabel = (iso: string, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('ms-MY', { ...opts, timeZone: 'UTC' });

/** Admin → Statistik: anonymous active devices plus community activity. */
export function StatsPanel() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [at, setAt] = useState<Date | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchAdminStats()
      .then((s) => {
        setStats(s);
        setAt(new Date());
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);

  if (error) return <p role="alert" className="text-sm text-red-600">{error}</p>;
  if (!stats) return <Loader2 className="mx-auto size-6 animate-spin text-ink-400" />;

  const newToday = stats.daily.at(-1)?.new ?? 0;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-xs text-ink-500">
        <span>{at && `Dikemas kini ${at.toLocaleTimeString('ms-MY', { hour: '2-digit', minute: '2-digit' })}`}</span>
        <Button variant="ghost" className="px-2 py-1 text-xs" onClick={load} disabled={loading}>
          <RefreshCw className={cn('size-3.5', loading && 'animate-spin')} /> Muat semula
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Tile label="Aktif hari ini" value={stats.active_today} sub={newToday ? `+${newToday} peranti baru` : undefined} />
        <Tile label="Aktif 7 hari" value={stats.active_7d} sub={stats.installed_7d ? `${stats.installed_7d} guna app dipasang` : undefined} />
        <Tile label="Aktif 30 hari" value={stats.active_30d} />
        <Tile label="Jumlah peranti" value={stats.devices_total} sub="sejak kiraan bermula" />
      </div>

      <DailyChart daily={stats.daily} />

      <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-ink-200 dark:bg-ink-900 dark:ring-ink-800">
        <h3 className="mb-3 text-sm font-bold">Komuniti</h3>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3">
          <Fact label="Akaun berdaftar" value={stats.accounts_total} sub={`+${stats.accounts_7d} dalam 7 hari`} />
          <Fact label="Laporan jalan (7 hari)" value={stats.reports_7d} sub={`${stats.reports_total} semua`} />
          <Fact label="Rekod kemalangan" value={stats.accident_records} sub={stats.photos_pending ? `${stats.photos_pending} gambar menunggu` : undefined} warn={stats.photos_pending > 0} />
          <Fact label="Laluan komuniti" value={stats.community_routes} />
          <Fact label="Jalan pintas" value={stats.shortcuts} />
          <Fact label="Konvoi (7 hari)" value={stats.convoys_7d} />
          <Fact label="Kongsi live (7 hari)" value={stats.live_shares_7d} />
          <Fact label="Perjalanan disimpan" value={stats.trips_synced} sub="pengguna log masuk" />
        </dl>
      </section>

      <p className="text-[11px] leading-relaxed text-ink-400">
        "Peranti" ialah telefon atau pelayar yang membuka JalanGo, dikira sekali sehari dengan ID rawak tanpa nama. Pelayar berbeza, mod peribadi atau storan yang dipadam dikira sebagai peranti baru, jadi angka sebenar orang mungkin lebih rendah. Kiraan
        peranti bermula selepas ciri ini dilancarkan; carian dan laluan dikira sejak awal.
      </p>
    </div>
  );
}

function Tile({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-ink-200 dark:bg-ink-900 dark:ring-ink-800">
      <p className="text-xs text-ink-500 dark:text-ink-400">{label}</p>
      <p className="mt-1 text-3xl font-black tabular-nums">{value.toLocaleString('ms-MY')}</p>
      {sub && <p className="mt-0.5 text-[11px] text-ink-500 dark:text-ink-400">{sub}</p>}
    </div>
  );
}

function Fact({ label, value, sub, warn }: { label: string; value: number; sub?: string; warn?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-ink-500 dark:text-ink-400">{label}</dt>
      <dd className="text-lg font-bold tabular-nums">{value.toLocaleString('ms-MY')}</dd>
      {sub && <dd className={cn('text-[11px]', warn ? 'font-semibold text-amber-600 dark:text-amber-400' : 'text-ink-500 dark:text-ink-400')}>{sub}</dd>}
    </div>
  );
}

/** Active devices per day, last 30 days. Tap or hover a bar for that day's numbers. */
function DailyChart({ daily }: { daily: DailyStat[] }) {
  const [sel, setSel] = useState<number>(daily.length - 1);
  const [table, setTable] = useState(false);
  const max = useMemo(() => Math.max(1, ...daily.map((d) => d.active)), [daily]);
  const top = niceMax(max);
  const s = daily[sel] ?? daily[daily.length - 1];

  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-ink-200 dark:bg-ink-900 dark:ring-ink-800">
      <div className="mb-1 flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold">Peranti aktif sehari</h3>
          <p className="text-xs text-ink-500 dark:text-ink-400">30 hari lepas</p>
        </div>
        <Button variant="ghost" className="px-2 py-1 text-xs" onClick={() => setTable((v) => !v)} aria-pressed={table}>
          <Table2 className="size-3.5" /> {table ? 'Carta' : 'Jadual'}
        </Button>
      </div>

      {table ? (
        <div className="max-h-80 overflow-y-auto">
          <table className="w-full text-right text-xs tabular-nums">
            <thead className="sticky top-0 bg-white text-ink-500 dark:bg-ink-900">
              <tr>
                <th className="py-1 text-left font-semibold">Tarikh</th>
                <th className="py-1 font-semibold">Aktif</th>
                <th className="py-1 font-semibold">Baru</th>
                <th className="py-1 font-semibold">Carian</th>
                <th className="py-1 font-semibold">Laluan</th>
              </tr>
            </thead>
            <tbody>
              {[...daily].reverse().map((d) => (
                <tr key={d.day} className="border-t border-ink-100 dark:border-ink-800">
                  <td className="py-1 text-left">{dayLabel(d.day, { weekday: 'short', day: 'numeric', month: 'short' })}</td>
                  <td className="py-1 font-semibold">{d.active}</td>
                  <td className="py-1">{d.new}</td>
                  <td className="py-1">{d.searches}</td>
                  <td className="py-1">{d.routes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <>
          {/* Selected day readout (works for touch, where there is no hover) */}
          <p className="mb-2 min-h-5 text-xs text-ink-600 dark:text-ink-300" aria-live="polite">
            <span className="font-semibold text-ink-900 dark:text-white">{dayLabel(s.day, { weekday: 'short', day: 'numeric', month: 'short' })}</span> · {s.active} aktif · {s.new} baru · {s.searches} carian · {s.routes} laluan
          </p>
          <div className="relative mt-4 h-40">
            {/* recessive grid: top and middle lines with labels */}
            {[1, 0.5].map((f) => (
              <div key={f} className="absolute inset-x-0 flex items-center gap-1" style={{ bottom: `${f * 100}%` }}>
                <span className="w-6 -translate-y-1/2 text-right text-[10px] tabular-nums text-ink-400">{Math.round(top * f)}</span>
                <span className="h-px flex-1 -translate-y-1/2 bg-ink-100 dark:bg-ink-800" />
              </div>
            ))}
            <div className="absolute inset-y-0 left-7 right-0 flex items-end gap-[2px] border-b border-ink-200 dark:border-ink-700" role="list" aria-label="Peranti aktif sehari">
              {daily.map((d, i) => (
                <button
                  key={d.day}
                  type="button"
                  role="listitem"
                  aria-label={`${dayLabel(d.day)}: ${d.active} aktif, ${d.new} baru`}
                  onClick={() => setSel(i)}
                  onMouseEnter={() => setSel(i)}
                  onFocus={() => setSel(i)}
                  className="group relative flex h-full flex-1 items-end"
                >
                  <span
                    className={cn('w-full rounded-t-[4px] transition-colors', i === sel ? 'bg-jade-600 dark:bg-jade-400' : 'bg-jade-500/70 group-hover:bg-jade-500 dark:bg-jade-500/60')}
                    style={{ height: d.active ? `${Math.max(2, (d.active / top) * 100)}%` : '0%' }}
                  />
                </button>
              ))}
            </div>
          </div>
          <div className="ml-7 mt-1 flex justify-between text-[10px] text-ink-400">
            <span>{dayLabel(daily[0].day)}</span>
            <span>{dayLabel(daily[Math.floor(daily.length / 2)].day)}</span>
            <span>Hari ini</span>
          </div>
        </>
      )}
    </section>
  );
}

/** Round the axis top up to 1, 2, 5 × 10ⁿ so gridline labels are tidy. */
export function niceMax(n: number): number {
  if (n <= 5) return 5;
  const p = 10 ** Math.floor(Math.log10(n));
  return [1, 2, 5, 10].map((m) => m * p).find((v) => v >= n)!;
}
