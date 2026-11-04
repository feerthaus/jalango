import { Megaphone, ShieldCheck } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { PagePanel } from '@/components/ui/PagePanel';
import { REPORT_TYPES } from '@/lib/reportTypes';

export function ReportsPage() {
  return (
    <PagePanel title="Reports" subtitle="Community road reports near you">
      <div className="rounded-2xl bg-white shadow-sm ring-1 ring-ink-200 dark:bg-ink-900 dark:ring-ink-800">
        <EmptyState icon={Megaphone} title="No community reports yet">
          Live reports from other drivers will appear here and on the map once community reporting is switched on. JalanGo never
          shows invented incidents.
        </EmptyState>
      </div>

      <h2 className="px-1 pb-2 pt-6 text-xs font-semibold uppercase tracking-wider text-ink-400">What you’ll be able to report</h2>
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {REPORT_TYPES.map(({ type, label, labelMs, icon: Icon, tone }) => (
          <li key={type} className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-ink-200 dark:bg-ink-900 dark:ring-ink-800">
            <span className={`grid size-10 place-items-center rounded-xl ${tone}`}>
              <Icon className="size-5" />
            </span>
            <span>
              <span className="block text-sm font-semibold">{label}</span>
              <span className="block text-xs text-ink-400">{labelMs}</span>
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-4 flex items-start gap-2 px-1 text-xs text-ink-500 dark:text-ink-400">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-jade-500" />
        Reports will be tied to a signed-in account, rate-limited, and confirmed or resolved by other drivers.
      </p>
    </PagePanel>
  );
}
