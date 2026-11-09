import { Router } from 'express';
import { z } from 'zod';
import { getDirections, MAX_VIA } from '../services/directions.js';

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
  avoidTolls: z
    .enum(['0', '1', 'true', 'false'])
    .optional()
    .transform((v) => v === '1' || v === 'true'),
});

export const directionsRouter = Router();

directionsRouter.get('/', async (req, res) => {
  const { from, to, avoidTolls, via, heading } = query.parse(req.query);
  res.json({ routes: await getDirections(from, to, { avoidTolls, via, heading }) });
});
