import { Router } from 'express';
import { z } from 'zod';
import { getKtmbTimetable } from '../services/ktmb.js';
import { planTrainTrips } from '../services/trainPlanner.js';
import { getTransitNetwork } from '../services/transit/feeds.js';
import { planTransit } from '../services/transit/raptor.js';

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

/** Same trip asked again within a few minutes (e.g. tab switches, two people nearby): answer from memory. */
const RESULT_TTL_MS = 3 * 60_000;
const results = new Map<string, { at: number; value: unknown }>();
const key = (p: { lat: number; lng: number }) => `${p.lat.toFixed(3)},${p.lng.toFixed(3)}`;

/** Train options (KTMB: ETS, Intercity, Komuter) between two points, with estimated fares. */
transitRouter.get('/train', async (req, res) => {
  const { from, to, at } = trainQuery.parse(req.query);
  const now = Date.now();
  const leaveAfter = at && at > now && at < now + 7 * 86_400_000 ? at : now;
  const k = `${key(from)}|${key(to)}|${Math.floor(leaveAfter / RESULT_TTL_MS)}`;
  const hit = results.get(k);
  res.setHeader('Cache-Control', 'public, max-age=120');
  if (hit && Date.now() - hit.at < RESULT_TTL_MS) return void res.json(hit.value);
  const tt = await getKtmbTimetable();
  const value = { options: planTrainTrips(tt, from, to, leaveAfter), source: 'KTMB GTFS (data.gov.my)', faresEstimated: true };
  if (results.size > 500) results.clear();
  results.set(k, { at: Date.now(), value });
  res.json(value);
});

/**
 * Public transport between two points: KTMB (ETS, Intercity, Komuter) and Rapid KL
 * rail (LRT, MRT, Monorail, BRT), changing lines on foot between stations.
 * Fares are estimates.
 */
transitRouter.get('/plan', async (req, res) => {
  const { from, to, at } = trainQuery.parse(req.query);
  const now = Date.now();
  const leaveAfter = at && at > now && at < now + 7 * 86_400_000 ? at : now;
  const k = `plan|${key(from)}|${key(to)}|${Math.floor(leaveAfter / RESULT_TTL_MS)}`;
  const hit = results.get(k);
  res.setHeader('Cache-Control', 'public, max-age=120');
  if (hit && Date.now() - hit.at < RESULT_TTL_MS) return void res.json(hit.value);
  const net = await getTransitNetwork();
  const value = { options: planTransit(net, from, to, leaveAfter), source: 'KTMB + Prasarana GTFS (data.gov.my)', faresEstimated: true };
  if (results.size > 500) results.clear();
  results.set(k, { at: Date.now(), value });
  res.json(value);
});
