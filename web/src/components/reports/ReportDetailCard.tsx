import { Check, CheckCheck, Loader2, ThumbsUp, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation } from '@/contexts/LocationContext';
import { useReports } from '@/contexts/ReportsContext';
import { reportMeta } from '@/lib/reportTypes';
import type { ConfirmationType, TrafficReport } from '@/types';
import { formatRelativeTime } from '@/utils/format';
import { formatDistance, haversineMeters } from '@/utils/geo';

export function ReportDetailCard({ report, onClose }: { report: TrafficReport; onClose: () => void }) {
  const { user } = useAuth();
  const { fix } = useLocation();
  const { vote, remove, myVotes } = useReports();
  const navigate = useNavigate();
  const [busy, setBusy] = useState<ConfirmationType | 'delete' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const meta = reportMeta(report.report_type);
  const Icon = meta.icon;
  const mine = user?.id === report.user_id;
  const myVote = myVotes[report.id];
  const distance = fix ? haversineMeters(fix.coordinates, { lat: report.latitude, lng: report.longitude }) : null;

  const act = async (kind: ConfirmationType | 'delete') => {
    if (!user) {
      navigate('/profile');
      return;
    }
    setBusy(kind);
    setError(null);
    try {
      if (kind === 'delete') {
        await remove(report.id);
        onClose();
      } else {
        await vote(report.id, kind);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(null);
    }
  };

  return (
    <article aria-label={`${meta.label} report`} className="glass pointer-events-auto animate-slide-up rounded-3xl p-4 shadow-float ring-1 ring-ink-900/5 dark:ring-white/10">
      <div className="flex items-start gap-3">
        <span className={`grid size-12 shrink-0 place-items-center rounded-2xl ${meta.tone}`}>
          <Icon className="size-6" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold leading-tight">
            {meta.label} <span className="text-sm font-normal text-ink-400">· {meta.labelMs}</span>
          </h2>
          <p className="mt-0.5 text-xs text-ink-500 dark:text-ink-400">
            Reported {formatRelativeTime(report.created_at)}
            {distance !== null && ` · ${formatDistance(distance)} away`}
          </p>
          {report.description && <p className="mt-2 text-sm">{report.description}</p>}
          <p className="mt-2 flex gap-3 text-xs text-ink-500 dark:text-ink-400">
            <span>
              <ThumbsUp className="mr-1 inline size-3.5" />
              {report.confirm_count} still there
            </span>
            <span>
              <CheckCheck className="mr-1 inline size-3.5" />
              {report.resolve_count} cleared
            </span>
          </p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close" className="-mr-1 -mt-1 grid size-9 place-items-center rounded-full text-ink-500 hover:bg-ink-100 dark:hover:bg-ink-800">
          <X className="size-5" />
        </button>
      </div>

      <p className="mt-3 text-[11px] text-ink-400">Community report from JalanGo users — not verified by authorities.</p>

      {error && (
        <p role="alert" className="mt-2 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      {mine ? (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={() => act('resolved')} disabled={busy !== null || myVote === 'resolved'}>
            {busy === 'resolved' ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} It’s cleared
          </Button>
          <Button variant="danger" onClick={() => act('delete')} disabled={busy !== null}>
            {busy === 'delete' ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />} Delete
          </Button>
        </div>
      ) : myVote ? (
        <p className="mt-3 rounded-xl bg-jade-500/10 px-3 py-2 text-sm font-medium text-jade-700 dark:text-jade-300">
          <Check className="mr-1 inline size-4" /> Thanks — you said it’s {myVote === 'confirm' ? 'still there' : 'cleared'}.
        </p>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button onClick={() => act('confirm')} disabled={busy !== null}>
            {busy === 'confirm' ? <Loader2 className="size-4 animate-spin" /> : <ThumbsUp className="size-4" />} Still there
          </Button>
          <Button variant="secondary" onClick={() => act('resolved')} disabled={busy !== null}>
            {busy === 'resolved' ? <Loader2 className="size-4 animate-spin" /> : <CheckCheck className="size-4" />} Not there
          </Button>
        </div>
      )}
      {!user && <p className="mt-2 text-center text-xs text-ink-400">Sign in to confirm or clear reports.</p>}
    </article>
  );
}
