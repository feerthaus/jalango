import { describe, expect, it } from 'vitest';
import type { ErrorEvent } from '@sentry/react';
import { scrub, scrubBreadcrumb, scrubEvent, stripQuery } from './monitoring';

describe('monitoring privacy scrubbing', () => {
  it('removes coordinates and query strings', () => {
    expect(scrub('No route from 3.13912,101.68653 to 1.85, 102.93011')).toBe('No route from [coords] to [coords]');
    expect(stripQuery('https://jalango.netlify.app/api/directions?from=101.68,3.13&to=102.9,1.8')).toBe('https://jalango.netlify.app/api/directions');
    expect(stripQuery('https://jalango.netlify.app/live/abcdef#x')).toBe('https://jalango.netlify.app/live/abcdef');
  });
  it('cleans events and breadcrumbs', () => {
    const e = scrubEvent({ type: undefined, request: { url: 'https://x/api/geo/reverse?lng=101.68653&lat=3.13912', headers: { a: 'b' } }, user: { id: 'u', ip_address: '1.2.3.4' }, exception: { values: [{ value: 'Bad 3.13912,101.68653' }] } } as ErrorEvent);
    expect(e.request?.url).toBe('https://x/api/geo/reverse');
    expect(e.request?.headers).toBeUndefined();
    expect(e.user).toBeUndefined();
    expect(e.exception?.values?.[0].value).toBe('Bad [coords]');
    expect(scrubBreadcrumb({ category: 'fetch', data: { url: '/api/directions?from=1,2' } })?.data?.url).toBe('/api/directions');
    expect(scrubBreadcrumb({ category: 'console', level: 'log', message: 'hi' })).toBeNull();
  });
});
