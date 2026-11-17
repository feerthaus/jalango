import { Router } from 'express';
import { z } from 'zod';
import { getKtmbTimetable } from '../services/ktmb.js';
import { planTrainTrips } from '../services/trainPlanner.js';

const point = z.string().transform((s, ctx) => {
  const [lng, lat] = s.split(',').map(Number);
  if (!Number.isFinite(lng) || !Number.isFinite(lat) || lng < 99 || lng > 120 || lat < 0 || lat > 8) {
    ctx.addIssue({ code: 'custom', message: 'expected "lng,lat" in Malaysia' });
    return z.NEVER;
  }
  return { lng, lat };
});

export const trainQuery = z.object({
  from: point,
  to: point,
  /** leave after (epoch ms); default now, at most 7 days ahead */
  at: z.coerce.number().int().optional(),
});

export const transitRouter = Router();

/** Train options (KTMB: ETS, Intercity, Komuter) between two points, with estimated fares. */
transitRouter.get('/train', async (req, res) => {
  const { from, to, at } = trainQuery.parse(req.query);
  const now = Date.now();
  const leaveAfter = at && at > now && at < now + 7 * 86_400_000 ? at : now;
  const tt = await getKtmbTimetable();
  res.setHeader('Cache-Control', 'public, max-age=120');
  res.json({ options: planTrainTrips(tt, from, to, leaveAfter), source: 'KTMB GTFS (data.gov.my)', faresEstimated: true });
});
