import { Router } from 'express';
import { z } from 'zod';
import { getDirectionsAvoiding, MAX_AVOID, MAX_VIA } from '../services/directions.js';

const point = z
  .string()
  .regex(/^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/, 'expected "lng,lat"')
  .transform((s) => {
    const [lng, lat] = s.split(',').map(Number);
    return { lng, lat };
  })
  .refine((p) => Math.abs(p.lng) <= 180 && Math.abs(p.lat) <= 90, 'out of range');

const viaList = z
  .string()
  .regex(/^-?\d+(\.\d+)?,-?\d+(\.\d+)?(;-?\d+(\.\d+)?,-?\d+(\.\d+)?)*$/, 'expected "lng,lat;lng,lat"')
  .transform((s) => s.split(';').map((pair) => {
    const [lng, lat] = pair.split(',').map(Number);
    return { lng, lat };
  }))
  .refine((pts) => pts.length <= MAX_VIA && pts.every((p) => Math.abs(p.lng) <= 180 && Math.abs(p.lat) <= 90), `at most ${MAX_VIA} valid points`);

const query = z.object({
  from: point,
  to: point,
  via: viaList.optional(),
  /** Driver's current heading (degrees). Stops the router snapping us onto the opposite carriageway. */
  heading: z.coerce.number().min(0).max(360).optional(),
  /** walking: footpaths and crossings (e.g. to a station); default driving */
  profile: z.enum(['driving', 'walking']).optional(),
  /** spots to route around, e.g. floods reported impassable: "lng,lat;lng,lat" (at most 10, in Malaysia) */
  avoid: z
    .string()
    .max(400)
    .transform((s, ctx) => {
      const pts = s.split(';').filter(Boolean).map((pair) => pair.split(',').map(Number));
      if (pts.length > MAX_AVOID || !pts.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y) && x >= 99 && x <= 120 && y >= 0.5 && y <= 7.6)) {
        ctx.addIssue({ code: 'custom', message: `avoid: at most ${MAX_AVOID} "lng,lat" points in Malaysia` });
        return z.NEVER;
      }
      return pts.map(([lng, lat]) => ({ lng, lat }));
    })
    .optional(),
  avoidTolls: z
    .enum(['0', '1', 'true', 'false'])
    .optional()
    .transform((v) => v === '1' || v === 'true'),
});

export const directionsRouter = Router();

directionsRouter.get('/', async (req, res) => {
  const { from, to, avoidTolls, via, heading, profile, avoid } = query.parse(req.query);
  const { routes, avoided } = await getDirectionsAvoiding(from, to, { avoidTolls, via, heading, walking: profile === 'walking', avoidPoints: avoid });
  res.json({ routes, avoided });
});
