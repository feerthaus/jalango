import { ArrowDown, ArrowUp, ChevronDown, Fuel } from 'lucide-react';
import { useEffect, useState } from 'react';
import { apiGet } from '@/services/apiClient';
import { cn } from '@/lib/cn';

interface FuelPrices {
  date: string;
  prices: Record<string, number>;
  change: Record<string, number>;
  source: string;
}

/** Display order and Malay labels for the data.gov.my columns we know; unknown columns still show under "Lain-lain". */
const MAIN: [string, string, string?][] = [
  ['ron95_budi95', 'RON95 BUDI95', 'Subsidi bersasar, warganegara layak'],
  ['ron95', 'RON95', 'Tanpa subsidi'],
  ['ron97', 'RON97'],
  ['diesel', 'Diesel', 'Semenanjung'],
  ['diesel_eastmsia', 'Diesel', 'Sabah, Sarawak & Labuan'],
];
const OTHER_LABELS: Record<string, string> = {
  ron95_skps: 'RON95 SKPS',
  diesel_budi: 'Diesel BUDI MADANI',
  diesel_skds: 'Diesel SKDS',
};

let cached: Promise<FuelPrices> | null = null;
function loadFuel(): Promise<FuelPrices> {
  cached ??= apiGet<FuelPrices>('/fuel').catch((err) => {
    cached = null;
    throw err;
  });
  return cached;
}

function formatDate(iso: string) {
  try {
    // A calendar date, not a moment: format in UTC so no time zone can shift the day
    return new Date(`${iso}T00:00:00Z`).toLocaleDateString('ms-MY', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  } catch {
    return iso;
  }
}

/** This week's official pump prices (data.gov.my). */
export function FuelPriceCard({ className }: { className?: string }) {
  const [data, setData] = useState<FuelPrices | null>(null);
  const [failed, setFailed] = useState(false);
  const [more, setMore] = useState(false);
  useEffect(() => {
    loadFuel().then(setData, () => setFailed(true));
  }, []);
  if (failed) return null; // a missing price card shouldn't get in the way
  if (!data) return <div className={cn('h-24 animate-pulse rounded-2xl bg-ink-100 dark:bg-ink-800', className)} aria-label="Loading fuel prices" />;

  const rows = MAIN.filter(([k]) => typeof data.prices[k] === 'number');
  const others = Object.keys(data.prices).filter((k) => !MAIN.some(([m]) => m === k));
  return (
    <section className={cn('rounded-2xl bg-white p-3 shadow-sm ring-1 ring-ink-200 dark:bg-ink-900 dark:ring-ink-800', className)} aria-label="Harga minyak minggu ini">
      <h3 className="mb-2 flex items-center gap-2 text-sm font-bold">
        <Fuel className="size-4 text-red-600" /> Harga minyak minggu ini
        <span className="ml-auto text-xs font-normal text-ink-400">mulai {formatDate(data.date)}</span>
      </h3>
      <ul className="divide-y divide-ink-100 dark:divide-ink-800">
        {rows.map(([k, label, note]) => (
          <PriceRow key={k} label={label} note={note} price={data.prices[k]} change={data.change[k]} />
        ))}
        {more && others.map((k) => <PriceRow key={k} label={OTHER_LABELS[k] ?? k.toUpperCase().replace(/_/g, ' ')} price={data.prices[k]} change={data.change[k]} />)}
      </ul>
      <div className="mt-1 flex items-center justify-between text-[11px] text-ink-400">
        <span>Sumber: data.gov.my (Kementerian Kewangan)</span>
        {others.length > 0 && (
          <button type="button" onClick={() => setMore((m) => !m)} className="flex items-center gap-0.5 font-semibold text-ink-500">
            {more ? 'Kurang' : 'Lain-lain'} <ChevronDown className={cn('size-3.5 transition', more && 'rotate-180')} />
          </button>
        )}
      </div>
    </section>
  );
}

function PriceRow({ label, note, price, change }: { label: string; note?: string; price: number; change?: number }) {
  const c = change !== undefined ? Math.round(change * 100) / 100 : 0;
  return (
    <li className="flex items-center gap-2 py-1.5">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{label}</p>
        {note && <p className="truncate text-[11px] text-ink-500">{note}</p>}
      </div>
      {c !== 0 && (
        <span className={cn('flex items-center text-xs font-semibold', c < 0 ? 'text-jade-600' : 'text-red-600')} aria-label={`${c < 0 ? 'turun' : 'naik'} ${Math.abs(c * 100).toFixed(0)} sen`}>
          {c < 0 ? <ArrowDown className="size-3" /> : <ArrowUp className="size-3" />}
          {Math.abs(c * 100).toFixed(0)} sen
        </span>
      )}
      <span className="w-20 text-right text-base font-black tabular-nums">RM{price.toFixed(2)}</span>
    </li>
  );
}
