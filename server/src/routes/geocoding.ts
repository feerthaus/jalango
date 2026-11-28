import { Router } from 'express';
import { z } from 'zod';
import { withUsagePolicy } from '../lib/usageGuard.js';
import { placeFromMapsLink } from '../services/mapsLink.js';
import { searchRentals } from '../services/rentals.js';
import { placesAround } from '../services/around.js';
import { logMiss, smartSearch } from '../services/searchLearning.js';
import { CATEGORY_MAP, reverseGeocode, searchAlong, searchCategory } from '../services/mapbox.js';

const lng = z.coerce.number().min(-180).max(180);
const lat = z.coerce.number().min(-90).max(90);

const searchQuery = z.object({
  q: z.string().trim().min(2).max(120),
  lng: lng.optional(),
  lat: lat.optional(),
  limit: z.coerce.number().int().min(1).max(10).optional(),
  /** "1": if nothing is found, let the AI rewrite the text and try again (sent after the user stops typing) */
  ai: z.enum(['0', '1']).optional(),
});

const reverseQuery = z.object({ lng, lat });

const categoryQuery = z.object({
  category: z.enum([...(Object.keys(CATEGORY_MAP) as (keyof typeof CATEGORY_MAP)[]), 'rnr', 'homestay', 'stay']),
  lng,
  lat,
  limit: z.coerce.number().int().min(1).max(25).optional(),
});

/** "lng,lat;lng,lat;…" — at most 8 points, all inside Malaysia's bounding box. */
export const alongQuery = z.object({
  category: categoryQuery.shape.category,
  points: z
    .string()
    .max(400)
    .transform((s, ctx) => {
      const pts = s.split(';').map((pair) => pair.split(',').map(Number));
      const valid = pts.length >= 1 && pts.length <= 8 && pts.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y) && x >= 99 && x <= 120 && y >= 0 && y <= 8);
      if (!valid) {
        ctx.addIssue({ code: 'custom', message: 'points must be 1–8 "lng,lat" pairs in Malaysia' });
        return z.NEVER;
      }
      return pts.map(([x, y]) => ({ lng: x, lat: y }));
    }),
});

export const geocodingRouter = Router();

geocodingRouter.get('/search', async (req, res) => {
  const { q, lng, lat, limit, ai } = searchQuery.parse(req.query);
  const near = lng !== undefined && lat !== undefined ? { lng, lat } : undefined;
  const { places, rewrittenTo } = await smartSearch(q, near, limit, { ai: ai === '1' });
  res.json({ results: places, rewrittenTo });
});

/**
 * "Tak jumpa?" and searches where nothing was tapped. Only the text (and an
 * optional place the user pointed to) is kept, without who or where.
 */
export const searchMissSchema = z.object({
  query: z.string().trim().min(2).max(120),
  kind: z.enum(['no_click', 'reported']),
  note: z.string().trim().max(280).optional(),
  hint: z.object({ name: z.string().trim().min(1).max(120), lat, lng }).optional(),
});
geocodingRouter.post('/miss', async (req, res) => {
  const body = searchMissSchema.parse(req.body);
  await logMiss(body.query, body.kind, { note: body.note || undefined, hint: body.hint });
  res.status(202).json({ ok: true });
});

/** A pasted Google Maps link (or "lat, lng") → the place it points to. */
const linkQuery = z.object({ url: z.string().trim().min(5).max(2000), lng: lng.optional(), lat: lat.optional() });
geocodingRouter.get('/link', async (req, res) => {
  const { url, lng, lat } = linkQuery.parse(req.query);
  const near = lng !== undefined && lat !== undefined ? { lng, lat } : undefined;
  res.json({ result: await placeFromMapsLink(url, near) });
});

geocodingRouter.get('/reverse', async (req, res) => {
  const { lng, lat } = reverseQuery.parse(req.query);
  res.json({ result: await reverseGeocode({ lng, lat }) });
});

geocodingRouter.get('/along', async (req, res) => {
  const { category, points } = alongQuery.parse(req.query);
  // Nice-to-have and fans out to many calls: fail closed if usage can't be counted
  res.json({ results: await withUsagePolicy('optional', () => searchAlong(category, points)) });
});

export const aroundQuery = z.object({
  kind: z.enum(['makan', 'menarik']),
  lng: z.coerce.number().min(99).max(120),
  lat: z.coerce.number().min(0).max(8),
  radius: z.coerce.number().int().min(300).max(10_000).default(3000),
});

/** "Sekitar sini": community picks and JalanGo POIs around a point (our own data, no paid call) */
geocodingRouter.get('/around', async (req, res) => {
  const { kind, lng, lat, radius } = aroundQuery.parse(req.query);
  res.json({ results: await placesAround({ lat, lng }, kind, radius, 12) });
});

geocodingRouter.get('/category', async (req, res) => {
  const { category, lng, lat, limit } = categoryQuery.parse(req.query);
  const near = { lng, lat };
  if (category === 'homestay' || category === 'car_rental') {
    res.json({ results: await withUsagePolicy('optional', () => searchRentals(category, near, limit)) });
    return;
  }
  res.json({ results: await withUsagePolicy('optional', () => searchCategory(category, near, limit)) });
});
