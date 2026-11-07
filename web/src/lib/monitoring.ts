/**
 * Crash reporting (Sentry), switched on only when VITE_SENTRY_DSN is set.
 * Privacy: no personal data, no IP, no session replay, and URLs/messages are
 * scrubbed of query strings and coordinates before anything leaves the phone.
 */
import type { Breadcrumb, ErrorEvent } from '@sentry/react';

const dsn = (import.meta.env.VITE_SENTRY_DSN ?? '').trim();
type SentryModule = typeof import('@sentry/react');
let sentry: SentryModule | null = null;

/** "3.13912,101.68653" / "101.68,3.13" → "[coords]" */
const COORDS = /-?\d{1,3}\.\d{2,},\s*-?\d{1,3}\.\d{2,}/g;
export function scrub(text: string): string {
  return text.replace(COORDS, '[coords]');
}
export function stripQuery(url: string): string {
  const i = url.search(/[?#]/);
  return scrub(i === -1 ? url : url.slice(0, i));
}

export function scrubEvent(event: ErrorEvent): ErrorEvent {
  if (event.request?.url) event.request.url = stripQuery(event.request.url);
  if (event.request) {
    delete event.request.query_string;
    delete event.request.cookies;
    delete event.request.headers;
  }
  delete event.user;
  if (event.message) event.message = scrub(event.message);
  for (const ex of event.exception?.values ?? []) if (ex.value) ex.value = scrub(ex.value);
  return event;
}

export function scrubBreadcrumb(b: Breadcrumb): Breadcrumb | null {
  if (b.category === 'console' && b.level !== 'error' && b.level !== 'warning') return null;
  const data = b.data as Record<string, unknown> | undefined;
  if (data) {
    for (const k of ['url', 'from', 'to']) if (typeof data[k] === 'string') data[k] = stripQuery(data[k] as string);
  }
  if (b.message) b.message = scrub(b.message);
  return b;
}

export function initMonitoring() {
  if (!dsn) return;
  void import('@sentry/react').then((S) => {
    S.init({
      dsn,
      environment: import.meta.env.MODE,
      sendDefaultPii: false,
      tracesSampleRate: 0,
      beforeSend: (event) => scrubEvent(event),
      beforeBreadcrumb: (b) => scrubBreadcrumb(b),
      // Noise from browser extensions and flaky mobile networks
      ignoreErrors: ['ResizeObserver loop', 'Failed to fetch', 'Load failed', 'NetworkError when attempting to fetch resource', 'AbortError'],
    });
    sentry = S;
  });
}

/** Report a caught error (e.g. from the route error screen). Safe when monitoring is off. */
export function reportError(error: unknown, context?: Record<string, unknown>) {
  try {
    sentry?.captureException(error, context ? { extra: context } : undefined);
  } catch {
    /* never let reporting crash the app */
  }
}
