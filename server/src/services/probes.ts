import { z } from 'zod';
import { HttpError } from '../lib/errors.js';
import { supabaseAdmin } from '../lib/supabaseAdmin.js';

/**
 * Anonymous GPS "probe" samples contributed by drivers who opted in.
 * No user id is stored: a random per-trip session id groups samples so
 * speeds can later be aggregated per road segment.
 */
const sample = z.object({
  t: z.number().int(), // epoch ms
  lat: z.number().min(0.5).max(7.6), // Malaysia only
  lng: z.number().min(99.4).max(119.5),
  speed: z.number().min(0).max(70).nullable(), // m/s (≈250 km/h cap)
  heading: z.number().min(0).max(360).nullable(),
  accuracy: z.number().min(0).max(100),
});

export const probeBatch = z
  .object({
    sessionId: z.string().uuid(),
    samples: z.array(sample).min(1).max(120),
  })
  .superRefine((batch, ctx) => {
    const now = Date.now();
    let prev = -Infinity;
    for (const [i, s] of batch.samples.entries()) {
      if (s.t > now + 60_000 || s.t < now - 24 * 3600_000) {
        ctx.addIssue({ code: 'custom', path: ['samples', i, 't'], message: 'timestamp out of range' });
        return;
      }
      if (s.t <= prev) {
        ctx.addIssue({ code: 'custom', path: ['samples', i, 't'], message: 'timestamps must increase' });
        return;
      }
      prev = s.t;
    }
  });

export type ProbeBatch = z.infer<typeof probeBatch>;

export async function storeProbes(batch: ProbeBatch): Promise<{ stored: boolean; count: number }> {
  if (!supabaseAdmin) return { stored: false, count: 0 };

  const rows = batch.samples.map((s) => ({
    session_id: batch.sessionId,
    recorded_at: new Date(s.t).toISOString(),
    latitude: s.lat,
    longitude: s.lng,
    speed_mps: s.speed,
    heading: s.heading,
    accuracy_m: s.accuracy,
  }));

  const { error } = await supabaseAdmin.from('probe_samples').insert(rows);
  if (error) {
    console.error('[jalango] probe insert failed', error.message);
    throw new HttpError(502, 'storage_error', 'Could not store traffic samples');
  }
  return { stored: true, count: rows.length };
}
