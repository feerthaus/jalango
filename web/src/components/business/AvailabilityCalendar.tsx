import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useMemo, useState } from 'react';
import { cn } from '@/lib/cn';

const todayMY = () => new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10);
const iso = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

/**
 * Month grid, up to ~12 months ahead. Owner mode: tap a day to mark it full (red)
 * or free again. Renter mode (`pick`): full days are greyed out and the renter
 * taps a start and an end date.
 */
export function AvailabilityCalendar({
  blocked,
  onToggle,
  busyDay,
  pick,
}: {
  blocked: Set<string>;
  onToggle?: (day: string, block: boolean) => void;
  busyDay?: string | null;
  pick?: { from: string | null; to: string | null; onPick: (day: string) => void };
}) {
  const today = todayMY();
  const [offset, setOffset] = useState(0);
  const { year, month, cells, label } = useMemo(() => {
    const [ty, tm] = today.split('-').map(Number);
    const first = new Date(Date.UTC(ty, tm - 1 + offset, 1));
    const y = first.getUTCFullYear();
    const m = first.getUTCMonth();
    const days = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    const lead = (first.getUTCDay() + 6) % 7; // Monday first
    const out: (string | null)[] = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => iso(y, m, i + 1))];
    return { year: y, month: m, cells: out, label: first.toLocaleDateString('ms-MY', { month: 'long', year: 'numeric', timeZone: 'UTC' }) };
  }, [offset, today]);

  const inRange = (day: string) => Boolean(pick?.from && (day === pick.from || (pick.to && day >= pick.from && day <= pick.to)));

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <button type="button" onClick={() => setOffset((o) => Math.max(0, o - 1))} disabled={offset === 0} aria-label="Bulan sebelum" className="grid size-8 place-items-center rounded-lg disabled:opacity-30">
          <ChevronLeft className="size-4" />
        </button>
        <p className="text-sm font-semibold" aria-live="polite">{label}</p>
        <button type="button" onClick={() => setOffset((o) => Math.min(11, o + 1))} disabled={offset === 11} aria-label="Bulan seterusnya" className="grid size-8 place-items-center rounded-lg disabled:opacity-30">
          <ChevronRight className="size-4" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-ink-500">
        {['Isn', 'Sel', 'Rab', 'Kha', 'Jum', 'Sab', 'Ahd'].map((d) => <span key={d}>{d}</span>)}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1" data-month={`${year}-${month}`}>
        {cells.map((day, i) =>
          day ? (
            <button
              key={day}
              type="button"
              disabled={day < today || busyDay === day || (pick && blocked.has(day))}
              onClick={() => (pick ? pick.onPick(day) : onToggle?.(day, !blocked.has(day)))}
              aria-pressed={pick ? inRange(day) : blocked.has(day)}
              aria-label={`${day}${blocked.has(day) ? ', penuh' : ''}`}
              className={cn(
                'aspect-square rounded-lg text-sm font-semibold tabular-nums disabled:opacity-30',
                pick
                  ? blocked.has(day)
                    ? 'bg-ink-200 text-ink-400 line-through dark:bg-ink-800'
                    : inRange(day)
                      ? 'bg-jade-500 text-white'
                      : 'bg-ink-100 dark:bg-ink-800'
                  : blocked.has(day)
                    ? 'bg-red-600 text-white'
                    : 'bg-ink-100 dark:bg-ink-800',
                day === today && 'ring-2 ring-jade-500',
              )}
            >
              {Number(day.slice(8))}
            </button>
          ) : (
            <span key={`e${i}`} />
          ),
        )}
      </div>
      {pick ? (
        <p className="mt-2 text-xs text-ink-500"><span className="mr-1 inline-block size-3 rounded bg-ink-300 align-middle" /> Penuh. Tekan tarikh mula, kemudian tarikh akhir.</p>
      ) : (
        <p className="mt-2 text-xs text-ink-500"><span className="mr-1 inline-block size-3 rounded bg-red-600 align-middle" /> Penuh / tidak tersedia. Tekan tarikh untuk tukar.</p>
      )}
    </div>
  );
}
