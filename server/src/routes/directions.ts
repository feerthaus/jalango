import { Router } from 'express';
import { z } from 'zod';
import { getDirections } from '../services/directions.js';

const point = z
  .string()
  .regex(/^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/, 'expected "lng,lat"')
  .transform((s) => {
    const [lng, lat] = s.split(',').map(Number);
    return { lng, lat };
  })
  .refine((p) => Math.abs(p.lng) <= 180 && Math.abs(p.lat) <= 90, 'out of range');

const query = z.object({
  from: point,
  to: point,
  avoidTolls: z
    .enum(['0', '1', 'true', 'false'])
    .optional()
    .transform((v) => v === '1' || v === 'true'),
});

export const directionsRouter = Router();

directionsRouter.get('/', async (req, res) => {
  const { from, to, avoidTolls } = query.parse(req.query);
  res.json({ routes: await getDirections(from, to, { avoidTolls }) });
});
