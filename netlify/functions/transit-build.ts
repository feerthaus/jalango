/**
 * Scheduled function: once a day (2:00 Malaysia time) rebuild the public
 * transport snapshot (trains, LRT/MRT and buses) from data.gov.my and store it
 * in Supabase Storage for the API. See server/src/services/transit/feeds.ts.
 */
import { rebuildSnapshot } from '../../server/src/services/transit/feeds';

export default async () => {
  const started = Date.now();
  try {
    const r = await rebuildSnapshot();
    console.log('[transit-build] ok', { ...r, ms: Date.now() - started });
    return new Response('ok');
  } catch (err) {
    console.error('[transit-build] failed', err instanceof Error ? err.message : err);
    return new Response('failed', { status: 500 });
  }
};

export const config = { schedule: '0 18 * * *' };
