import { RotateCcw, TriangleAlert } from 'lucide-react';
import { useRouteError } from 'react-router';
import { Button } from '@/components/ui/Button';
import { reportError } from '@/lib/monitoring';
import { useEffect } from 'react';

/** Route-level crash screen. */
export function ErrorBoundary() {
  const error = useRouteError();
  console.error('[JalanGo] route error', error);
  useEffect(() => reportError(error, { where: 'route' }), [error]);
  return (
    <div className="grid h-dvh place-items-center bg-ink-50 p-6 text-center dark:bg-ink-950">
      <div className="max-w-sm">
        <TriangleAlert className="mx-auto mb-3 size-10 text-amber-500" />
        <h1 className="text-xl font-bold">Something went wrong</h1>
        <p className="mt-1 text-sm text-ink-500 dark:text-ink-300">JalanGo hit an unexpected error. Reloading usually fixes it.</p>
        <Button className="mt-4" onClick={() => window.location.assign('/')}>
          <RotateCcw className="size-4" /> Reload
        </Button>
      </div>
    </div>
  );
}
