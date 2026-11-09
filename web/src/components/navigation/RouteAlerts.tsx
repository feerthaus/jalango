import { CheckCheck, Loader2, ThumbsUp, X } from 'lucide-react';
import { useState } from 'react';
import { useReports } from '@/contexts/ReportsContext';
import type { RouteAlertsState } from '@/hooks/useRouteAlerts';
import { cn } from '@/lib/cn';
import { reportMeta } from '@/lib/reportTypes';
import type { ConfirmationType } from '@/types';
import { formatRelativeTime } from '@/utils/format';
import { formatDistance } from '@/utils/geo';
import { useT } from '@/lib/i18n';

/** Hazard ahead + "still there?" prompt, shown under the maneuver banner. */
export function RouteAlerts({ alerts }: { alerts: RouteAlertsState }) {
  const [t] = useT();
  const { next, aheadCount, ask, dismissAsk } = alerts;
  if (ask) return <AskCard alerts={alerts} key={ask.id} onDone={dismissAsk} />;
  if (!next) return null;

  const meta = reportMeta(next.report.report_type);
  const Icon = meta.icon;
  const close = next.distance <= 800;
  return (
    <div
      role="alert"
      className={cn(
        'pointer-events-auto flex animate-slide-up items-center gap-3 rounded-2xl p-3 shadow-float',
        close ? 'bg-amber-400 text-ink-950' : 'bg-white text-ink-900 dark:bg-ink-800 dark:text-white',
      )}
    >
      <span className={`grid size-11 shrink-0 place-items-center rounded-xl ${meta.tone}`}>
        <Icon className="size-6" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-bold leading-tight">
          {t(`${meta.labelMs} di depan`, `${meta.label} ahead`)} · {formatDistance(next.distance)}
        </p>
        <p className={cn('truncate text-xs', close ? 'text-ink-800' : 'text-ink-500 dark:text-ink-300')}>
          {next.report.description || `${t('Dilaporkan', 'Reported')} ${formatRelativeTime(next.report.created_at)}`}
          {next.report.confirm_count > 0 && ` · ${next.report.confirm_count} ${t('pengesahan', 'confirmed')}`}
        </p>
      </div>
      {aheadCount > 1 && <span className="shrink-0 rounded-full bg-ink-950/10 px-2 py-0.5 text-xs font-semibold">+{aheadCount - 1}</span>}
    </div>
  );
}

function AskCard({ alerts, onDone }: { alerts: RouteAlertsState; onDone: () => void }) {
  const [t] = useT();
  const { vote } = useReports();
  const [busy, setBusy] = useState<ConfirmationType | null>(null);
  const [thanks, setThanks] = useState(false);
  const report = alerts.ask!;
  const meta = reportMeta(report.report_type);
  const Icon = meta.icon;

  const answer = async (type: ConfirmationType) => {
    setBusy(type);
    try {
      await vote(report.id, type);
      setThanks(true);
      setTimeout(onDone, 1200);
    } catch {
      onDone();
    }
  };

  return (
    <div role="dialog" aria-label="Is the report still there?" className="pointer-events-auto animate-slide-up rounded-2xl bg-white p-3 shadow-float dark:bg-ink-800">
      <div className="flex items-center gap-3">
        <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${meta.tone}`}>
          <Icon className="size-5" />
        </span>
        <p className="flex-1 font-bold">{thanks ? t('Terima kasih kerana membantu pemandu lain!', 'Thanks for helping other drivers!') : t(`${meta.labelMs} — masih ada?`, `${meta.label} — still there?`)}</p>
        <button type="button" onClick={onDone} aria-label="Dismiss" className="grid size-8 place-items-center rounded-full text-ink-400 hover:bg-ink-100 dark:hover:bg-ink-700">
          <X className="size-4" />
        </button>
      </div>
      {!thanks && (
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => answer('confirm')}
            disabled={busy !== null}
            className="flex h-12 items-center justify-center gap-2 rounded-xl bg-jade-500 font-semibold text-ink-950 active:scale-[0.98]"
          >
            {busy === 'confirm' ? <Loader2 className="size-5 animate-spin" /> : <ThumbsUp className="size-5" />} {t('Ya', 'Yes')}
          </button>
          <button
            type="button"
            onClick={() => answer('resolved')}
            disabled={busy !== null}
            className="flex h-12 items-center justify-center gap-2 rounded-xl bg-ink-100 font-semibold active:scale-[0.98] dark:bg-ink-700"
          >
            {busy === 'resolved' ? <Loader2 className="size-5 animate-spin" /> : <CheckCheck className="size-5" />} {t('Dah tiada', 'Gone')}
          </button>
        </div>
      )}
    </div>
  );
}
