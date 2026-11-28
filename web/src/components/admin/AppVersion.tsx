import { useEffect, useState } from 'react';
import { appBuiltAt, appCommit, fetchLiveVersion, shortCommit, type LiveVersion } from '@/lib/appVersion';
import { formatRelativeTime } from '@/utils/format';

/**
 * Admin only: which commit this app runs, and whether the site already serves a
 * newer one (then this tab is out of date and should reload).
 */
export function AppVersion() {
  const [live, setLive] = useState<LiveVersion | null | undefined>(undefined);
  useEffect(() => {
    const c = new AbortController();
    void fetchLiveVersion(c.signal).then(setLive);
    return () => c.abort();
  }, []);
  const newer = live && live.commit !== appCommit;
  return (
    <p className="mt-6 text-center text-xs text-ink-400">
      Versi app: <span className="font-mono">{shortCommit(appCommit)}</span>
      {appBuiltAt && <> · dibina {formatRelativeTime(appBuiltAt, 'ms')}</>}
      {newer && (
        <>
          {' '}
          ·{' '}
          <button type="button" className="font-semibold text-amber-700 underline dark:text-amber-300" onClick={() => window.location.reload()}>
            versi live {shortCommit(live.commit)} tersedia, muat semula
          </button>
        </>
      )}
    </p>
  );
}
