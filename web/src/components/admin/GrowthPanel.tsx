import { Loader2, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/cn';
import { fetchGrowth, realRate, type Growth } from '@/services/growthService';

const SOURCE_LABEL: Record<string, string> = {
  google: 'Google',
  facebook: 'Facebook',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  whatsapp: 'WhatsApp',
  telegram: 'Telegram',
  x: 'X',
  threads: 'Threads',
  youtube: 'YouTube',
  email: 'Email',
  sms: 'SMS',
  search_other: 'Enjin carian lain',
  referral: 'Laman lain (rujukan)',
  direct: 'Terus / tidak diketahui',
  other: 'Lain-lain (UTM)',
};

/**
 * Admin → Pertumbuhan: where new users come from, which channels bring real
 * (returning) users, and which bring account and business sign-ups.
 * Aggregates only (admin_growth); no individual devices or accounts.
 */
export function GrowthPanel() {
  const [days, setDays] = useState(30);
  const [g, setG] = useState<Growth | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchGrowth(days)
      .then(setG)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [days]);
  useEffect(load, [load]);

  if (error) return <p role="alert" className="text-sm text-red-600">{error}</p>;
  if (!g) return <Loader2 className="mx-auto size-6 animate-spin text-ink-400" />;

  const total = g.sources.reduce(
    (a, s) => ({ devices: a.devices + s.devices, real: a.real + s.real_users, signups: a.signups + s.signups, businesses: a.businesses + s.businesses }),
    { devices: 0, real: 0, signups: 0, businesses: 0 },
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div role="radiogroup" aria-label="Julat" className="flex rounded-xl bg-ink-100 p-1 text-sm font-semibold dark:bg-ink-800">
          {[7, 30, 90].map((d) => (
            <button key={d} type="button" role="radio" aria-checked={days === d} onClick={() => setDays(d)} className={cn('rounded-lg px-3 py-1', days === d ? 'bg-white shadow-sm dark:bg-ink-600' : 'text-ink-500')}>
              {d} hari
            </button>
          ))}
        </div>
        <Button variant="ghost" className="ml-auto px-2 py-1 text-xs" onClick={load} disabled={loading}>
          <RefreshCw className={cn('size-3.5', loading && 'animate-spin')} /> Muat semula
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Tile label="Peranti baharu" value={total.devices} />
        <Tile label="Pengguna sebenar" value={total.real} sub="kembali pada hari lain" />
        <Tile label="Daftar akaun" value={total.signups} />
        <Tile label="Daftar bisnes" value={total.businesses} />
      </div>

      {/* Phones: one card per channel, every number visible without scrolling */}
      <section className="space-y-2 sm:hidden" aria-label="Ikut saluran">
        <h3 className="text-sm font-bold">Ikut saluran (sentuhan pertama)</h3>
        {g.sources.length === 0 && <p className="text-sm text-ink-500">Belum ada data dalam julat ini.</p>}
        {g.sources.map((s) => {
          const rate = realRate(s);
          return (
            <div key={s.source} className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-ink-200 dark:bg-ink-900 dark:ring-ink-800">
              <p className="font-bold">{SOURCE_LABEL[s.source] ?? s.source}</p>
              <dl className="mt-2 grid grid-cols-4 gap-1.5 text-center">
                <Stat label="Peranti baharu" value={s.devices} />
                <Stat label="Pengguna sebenar" value={s.real_users} sub={rate === null ? undefined : `${rate}% kembali`} />
                <Stat label="Daftar akaun" value={s.signups} />
                <Stat label="Daftar bisnes" value={s.businesses} strong={s.businesses > 0} />
              </dl>
            </div>
          );
        })}
      </section>

      <section className="hidden overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-ink-200 sm:block dark:bg-ink-900 dark:ring-ink-800">
        <table className="w-full min-w-[560px] text-sm">
          <caption className="px-4 pt-3 text-left text-sm font-bold">Ikut saluran (sentuhan pertama)</caption>
          <thead className="text-left text-xs text-ink-500">
            <tr>
              <th className="px-4 py-2 font-semibold">Saluran</th>
              <th className="px-2 py-2 text-right font-semibold">Peranti baharu</th>
              <th className="px-2 py-2 text-right font-semibold">Pengguna sebenar</th>
              <th className="px-2 py-2 text-right font-semibold">Kadar kembali</th>
              <th className="px-2 py-2 text-right font-semibold">Daftar akaun</th>
              <th className="px-4 py-2 text-right font-semibold">Daftar bisnes</th>
            </tr>
          </thead>
          <tbody>
            {g.sources.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-ink-500">
                  Belum ada data dalam julat ini.
                </td>
              </tr>
            )}
            {g.sources.map((s) => {
              const rate = realRate(s);
              return (
                <tr key={s.source} className="border-t border-ink-100 dark:border-ink-800">
                  <td className="px-4 py-2 font-semibold">{SOURCE_LABEL[s.source] ?? s.source}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{s.devices}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{s.real_users}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-ink-500">{rate === null ? '—' : `${rate}%`}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{s.signups}</td>
                  <td className={cn('px-4 py-2 text-right tabular-nums', s.businesses > 0 && 'font-bold text-jade-700 dark:text-jade-400')}>{s.businesses}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {g.campaigns.length > 0 && (
        <section className="overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-ink-200 dark:bg-ink-900 dark:ring-ink-800">
          <table className="w-full min-w-[420px] text-sm">
            <caption className="px-4 pt-3 text-left text-sm font-bold">Kempen (utm_campaign)</caption>
            <thead className="text-left text-xs text-ink-500">
              <tr>
                <th className="px-4 py-2 font-semibold">Saluran</th>
                <th className="px-2 py-2 font-semibold">Kempen</th>
                <th className="px-2 py-2 text-right font-semibold">Peranti baharu</th>
                <th className="px-4 py-2 text-right font-semibold">Pengguna sebenar</th>
              </tr>
            </thead>
            <tbody>
              {g.campaigns.map((c) => (
                <tr key={`${c.source}:${c.campaign}`} className="border-t border-ink-100 dark:border-ink-800">
                  <td className="px-4 py-2">{SOURCE_LABEL[c.source] ?? c.source}</td>
                  <td className="px-2 py-2 font-mono text-xs">{c.campaign}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{c.devices}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{c.real_users}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <p className="text-xs leading-relaxed text-ink-500">
        Sejak {g.since}. <strong>Saluran</strong> direkod sekali bagi setiap peranti baharu, dari lawatan pertama (UTM, iklan, atau laman perujuk). <strong>Pengguna sebenar</strong> = peranti yang membuka JalanGo pada sekurang-kurangnya 2 hari berbeza dalam 14 hari pertama; <strong>kadar kembali</strong> hanya dikira untuk peranti berumur ≥14 hari. <strong>Daftar akaun/bisnes</strong> dikira sekali bagi setiap akaun baharu, ikut saluran peranti yang mendaftar. Kempen dengan kurang 5 peranti digabung dalam "(lain-lain)". Tiada data individu dipaparkan. WhatsApp tanpa UTM dikira "Terus".
      </p>
    </div>
  );
}

function Tile({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-ink-200 dark:bg-ink-900 dark:ring-ink-800">
      <p className="text-xs text-ink-500">{label}</p>
      <p className="text-2xl font-black tabular-nums">{value}</p>
      {sub && <p className="text-[11px] text-ink-400">{sub}</p>}
    </div>
  );
}

function Stat({ label, value, sub, strong }: { label: string; value: number; sub?: string; strong?: boolean }) {
  return (
    <div className="rounded-xl bg-ink-50 px-1 py-2 dark:bg-ink-800">
      <dt className="text-[11px] leading-tight text-ink-500">{label}</dt>
      <dd className={cn('text-lg font-black tabular-nums', strong && 'text-jade-700 dark:text-jade-400')}>{value}</dd>
      {sub && <dd className="text-[10px] text-ink-400">{sub}</dd>}
    </div>
  );
}
