import { ArrowLeft, Ban, Check, EyeOff, Loader2, RefreshCw, RotateCcw, ShieldAlert, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Wordmark } from '@/components/brand/LogoMark';
import { PhotoReviewQueue } from '@/components/accidents/PhotoReviewQueue';
import { AdminTwoFactor } from '@/components/admin/AdminTwoFactor';
import { fetchAdminStatus } from '@/services/adminAuth';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/cn';
import { reportMeta } from '@/lib/reportTypes';
import {
  fetchFeedback,
  fetchFlagQueue,
  FLAG_REASONS,
  moderate,
  setBan,
  setFeedbackStatus,
  type FeedbackItem,
  type FlagQueueItem,
} from '@/services/moderationService';
import { formatRelativeTime } from '@/utils/format';
import type { ReportType } from '@/types';

/** Moderation queue + feedback inbox. Only usable by users in public.admins (enforced in the database). */
export function AdminPage() {
  const { user, loading } = useAuth();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [needs2fa, setNeeds2fa] = useState(false);
  const [check, setCheck] = useState(0);
  const [tab, setTab] = useState<'flags' | 'photos' | 'feedback'>('flags');

  useEffect(() => {
    if (loading) return;
    if (!user) return setAllowed(false);
    void fetchAdminStatus().then((s) => {
      setAllowed(s.admin);
      setNeeds2fa(s.admin && !s.twoFactor);
    });
  }, [user, loading, check]);

  return (
    <div className="min-h-dvh overflow-y-auto bg-ink-50 dark:bg-ink-950">
      <header className="safe-top sticky top-0 z-10 border-b border-ink-200 bg-white/95 backdrop-blur dark:border-ink-800 dark:bg-ink-950/95">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <Link to="/profile" aria-label="Back" className="grid size-10 place-items-center rounded-xl hover:bg-ink-100 dark:hover:bg-ink-800">
            <ArrowLeft className="size-5" />
          </Link>
          <Wordmark className="flex-1" />
          <span className="rounded-full bg-red-500/10 px-2 py-1 text-xs font-semibold text-red-600">Admin</span>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 pb-16 pt-6">
        {allowed === null ? (
          <Loader2 className="mx-auto mt-10 size-6 animate-spin text-ink-400" />
        ) : !allowed ? (
          <EmptyState icon={ShieldAlert} title="Admins only">
            This page is for JalanGo moderators.
          </EmptyState>
        ) : needs2fa ? (
          <AdminTwoFactor onVerified={() => setCheck((n) => n + 1)} />
        ) : (
          <>
            <div role="tablist" className="mb-4 grid grid-cols-3 gap-1 rounded-2xl bg-ink-100 p-1 dark:bg-ink-900">
              {(['flags', 'photos', 'feedback'] as const).map((t) => (
                <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={cn('rounded-xl py-2 text-sm font-semibold', tab === t ? 'bg-white shadow-sm dark:bg-ink-700' : 'text-ink-500')}>
                  {t === 'flags' ? 'Reported content' : t === 'photos' ? 'Gambar kemalangan' : 'Feedback'}
                </button>
              ))}
            </div>
            {tab === 'flags' ? <FlagQueue /> : tab === 'photos' ? <PhotoReviewQueue /> : <FeedbackInbox />}
          </>
        )}
      </main>
    </div>
  );
}

function FlagQueue() {
  const [items, setItems] = useState<FlagQueueItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    fetchFlagQueue().then(setItems).catch((e: Error) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  const act = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try {
      await fn();
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setBusy(null);
    }
  };

  if (error) return <p role="alert" className="text-sm text-red-600">{error}</p>;
  if (!items) return <Loader2 className="mx-auto size-6 animate-spin text-ink-400" />;
  if (items.length === 0) return <EmptyState icon={Check} title="Nothing to review">No open reports. 🎉</EmptyState>;

  return (
    <>
      <div className="mb-2 flex justify-end">
        <Button variant="ghost" className="px-2 py-1 text-xs" onClick={load}>
          <RefreshCw className="size-3.5" /> Refresh
        </Button>
      </div>
      <ul className="space-y-3">
        {items.map((it) => {
          const key = `${it.content_type}:${it.content_id}`;
          const title = it.content_type === 'report' && it.title ? reportMeta(it.title as ReportType).label : it.title;
          const hidden = it.content_status === 'removed';
          return (
            <li key={key} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-ink-200 dark:bg-ink-900 dark:ring-ink-800">
              <div className="flex items-start gap-2">
                <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[11px] font-semibold uppercase dark:bg-ink-800">{it.content_type}</span>
                {hidden && <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-[11px] font-semibold text-amber-700">hidden</span>}
                {it.owner_banned && <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[11px] font-semibold text-red-600">owner banned</span>}
                <span className="ml-auto text-xs text-ink-400">{formatRelativeTime(it.last_flagged)}</span>
              </div>
              <p className="mt-2 font-semibold">{title ?? '(deleted content)'}</p>
              {it.detail && <p className="mt-0.5 text-sm text-ink-600 dark:text-ink-300">{it.detail}</p>}
              <p className="mt-2 text-xs text-ink-500">
                {it.flags} report{it.flags === 1 ? '' : 's'}: {it.reasons.map((r) => FLAG_REASONS.find((x) => x.id === r)?.label ?? r).join(', ')}
              </p>
              {it.notes.length > 0 && <p className="mt-1 text-xs italic text-ink-500">“{it.notes.slice(0, 3).join('” · “')}”</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                {!hidden ? (
                  <Button variant="danger" className="px-3 py-1.5 text-xs" disabled={busy !== null} onClick={() => act(key, () => moderate(it.content_type, it.content_id, 'remove'))}>
                    <EyeOff className="size-3.5" /> Remove
                  </Button>
                ) : (
                  <Button variant="secondary" className="px-3 py-1.5 text-xs" disabled={busy !== null} onClick={() => act(key, () => moderate(it.content_type, it.content_id, 'restore'))}>
                    <RotateCcw className="size-3.5" /> Restore
                  </Button>
                )}
                <Button variant="secondary" className="px-3 py-1.5 text-xs" disabled={busy !== null} onClick={() => act(key, () => moderate(it.content_type, it.content_id, hidden ? 'remove' : 'dismiss'))}>
                  {hidden ? <Check className="size-3.5" /> : <X className="size-3.5" />} {hidden ? 'Keep hidden' : 'Dismiss'}
                </Button>
                {it.owner_id && (
                  <Button variant="ghost" className="px-3 py-1.5 text-xs text-red-600" disabled={busy !== null} onClick={() => act(key, () => setBan(it.owner_id!, !it.owner_banned))}>
                    <Ban className="size-3.5" /> {it.owner_banned ? 'Unban owner' : 'Ban owner'}
                  </Button>
                )}
                {busy === key && <Loader2 className="size-4 animate-spin self-center text-ink-400" />}
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}

function FeedbackInbox() {
  const [items, setItems] = useState<FeedbackItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => {
    fetchFeedback().then(setItems).catch((e: Error) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  if (error) return <p role="alert" className="text-sm text-red-600">{error}</p>;
  if (!items) return <Loader2 className="mx-auto size-6 animate-spin text-ink-400" />;
  if (items.length === 0) return <EmptyState icon={Check} title="No feedback yet" />;
  return (
    <ul className="space-y-3">
      {items.map((f) => (
        <li key={f.id} className={cn('rounded-2xl bg-white p-4 shadow-sm ring-1 ring-ink-200 dark:bg-ink-900 dark:ring-ink-800', f.status === 'done' && 'opacity-60')}>
          <div className="flex items-center gap-2 text-xs">
            <span className="rounded-full bg-ink-100 px-2 py-0.5 font-semibold uppercase dark:bg-ink-800">{f.category.replace('_', ' ')}</span>
            {f.status === 'new' && <span className="rounded-full bg-jade-500/15 px-2 py-0.5 font-semibold text-jade-700">new</span>}
            <span className="ml-auto text-ink-400">{formatRelativeTime(f.created_at)}</span>
          </div>
          <p className="mt-2 whitespace-pre-wrap text-sm">{f.message}</p>
          <p className="mt-1 text-xs text-ink-400">
            {f.contact ?? 'no contact'} {f.page && `· ${f.page}`}
          </p>
          {f.status !== 'done' && (
            <Button variant="secondary" className="mt-2 px-3 py-1.5 text-xs" onClick={() => setFeedbackStatus(f.id, 'done').then(load)}>
              <Check className="size-3.5" /> Mark done
            </Button>
          )}
        </li>
      ))}
    </ul>
  );
}
