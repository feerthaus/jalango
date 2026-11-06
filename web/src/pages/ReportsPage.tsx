import { AlertTriangle, Megaphone, Radio, RefreshCw, ShieldCheck, ThumbsUp } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { ReportSheet } from '@/components/reports/ReportSheet';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { PagePanel } from '@/components/ui/PagePanel';
import { useLocation } from '@/contexts/LocationContext';
import { useReports } from '@/contexts/ReportsContext';
import { cn } from '@/lib/cn';
import { REPORT_TYPES, reportMeta } from '@/lib/reportTypes';
import type { ReportType, TrafficReport } from '@/types';
import { formatRelativeTime } from '@/utils/format';
import { formatDistance, haversineMeters } from '@/utils/geo';

export function ReportsPage() {
  const { available, reports, loading, error, live, refresh, selectReport } = useReports();
  const { fix } = useLocation();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<ReportType | 'all'>('all');
  const [reportOpen, setReportOpen] = useState(false);

  const list = useMemo(() => {
    const withDistance = reports
      .filter((r) => filter === 'all' || r.report_type === filter)
      .map((r) => ({ r, d: fix ? haversineMeters(fix.coordinates, { lat: r.latitude, lng: r.longitude }) : null }));
    return withDistance.sort((a, b) => (a.d ?? 0) - (b.d ?? 0) || b.r.created_at.localeCompare(a.r.created_at));
  }, [reports, filter, fix]);

  const open = (r: TrafficReport) => {
    selectReport(r);
    navigate('/');
  };

  return (
    <PagePanel
      title="Reports"
      subtitle={
        available ? (
          <span className="inline-flex items-center gap-1.5">
            <Radio className={cn('size-3.5', live ? 'text-jade-500' : 'text-ink-300')} />
            {live ? 'Live updates on' : 'Live updates connecting…'}
          </span>
        ) : (
          'Community road reports near you'
        )
      }
      action={
        available && (
          <Button className="px-3 py-2" onClick={() => setReportOpen(true)}>
            <Megaphone className="size-4" /> Report
          </Button>
        )
      }
    >
      {!available ? (
        <div className="rounded-2xl bg-white shadow-sm ring-1 ring-ink-200 dark:bg-ink-900 dark:ring-ink-800">
          <EmptyState icon={Megaphone} title="Community reports not connected">
            Reports from other drivers appear here once the Supabase database is configured. JalanGo never shows invented incidents.
          </EmptyState>
        </div>
      ) : (
        <>
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-3" role="tablist" aria-label="Filter by type">
            <FilterChip active={filter === 'all'} onClick={() => setFilter('all')}>
              All ({reports.length})
            </FilterChip>
            {REPORT_TYPES.map((t) => {
              const n = reports.filter((r) => r.report_type === t.type).length;
              return n > 0 ? (
                <FilterChip key={t.type} active={filter === t.type} onClick={() => setFilter(t.type)}>
                  {t.label} ({n})
                </FilterChip>
              ) : null;
            })}
          </div>

          <div className="rounded-2xl bg-white p-2 shadow-sm ring-1 ring-ink-200 dark:bg-ink-900 dark:ring-ink-800">
            {error ? (
              <EmptyState icon={AlertTriangle} title="Couldn’t load reports">
                <p>{error}</p>
                <Button variant="secondary" className="mt-3" onClick={refresh}>
                  <RefreshCw className="size-4" /> Try again
                </Button>
              </EmptyState>
            ) : loading && reports.length === 0 ? (
              <ul aria-busy className="space-y-1 p-1">
                {[0, 1, 2].map((i) => (
                  <li key={i} className="h-16 animate-pulse rounded-xl bg-ink-100 dark:bg-ink-800" />
                ))}
              </ul>
            ) : list.length === 0 ? (
              <EmptyState icon={ShieldCheck} title="No active reports nearby">
                Roads look clear from the community’s side. Seen something? Tap <strong>Report</strong>.
              </EmptyState>
            ) : (
              <ul aria-label="Nearby reports">
                {list.map(({ r, d }) => {
                  const meta = reportMeta(r.report_type);
                  const Icon = meta.icon;
                  return (
                    <li key={r.id}>
                      <button type="button" onClick={() => open(r)} className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left hover:bg-ink-100 dark:hover:bg-ink-800">
                        <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${meta.tone}`}>
                          <Icon className="size-5" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block font-medium">{meta.label}</span>
                          <span className="block truncate text-sm text-ink-500 dark:text-ink-300">{r.description || formatRelativeTime(r.created_at)}</span>
                        </span>
                        <span className="shrink-0 text-right text-xs text-ink-500 dark:text-ink-400">
                          {d !== null && <span className="block font-medium tabular-nums">{formatDistance(d)}</span>}
                          <span className="block">
                            {r.description ? formatRelativeTime(r.created_at) : ''}
                            {r.confirm_count > 0 && (
                              <>
                                {' '}
                                <ThumbsUp className="inline size-3" /> {r.confirm_count}
                              </>
                            )}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <p className="mt-3 flex items-start gap-2 px-1 text-xs text-ink-500 dark:text-ink-400">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-jade-500" />
            Community reports from JalanGo users, not verified by authorities. Reports expire automatically and are cleared when other
            drivers mark them gone.
          </p>
        </>
      )}
      {reportOpen && <ReportSheet onClose={() => setReportOpen(false)} />}
    </PagePanel>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        'shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold transition',
        active ? 'bg-jade-500 text-ink-950' : 'bg-white ring-1 ring-ink-200 hover:bg-ink-100 dark:bg-ink-900 dark:ring-ink-800 dark:hover:bg-ink-800',
      )}
    >
      {children}
    </button>
  );
}
