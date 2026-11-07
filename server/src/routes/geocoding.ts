import { Router } from 'express';
import { z } from 'zod';
import { CATEGORY_MAP, reverseGeocode, searchAlong, searchCategory, searchPlaces } from '../services/mapbox.js';

const lng = z.coerce.number().min(-180).max(180);
const lat = z.coerce.number().min(-90).max(90);

const searchQuery = z.object({
  q: z.string().trim().min(2).max(120),
  lng: lng.optional(),
  lat: lat.optional(),
  limit: z.coerce.number().int().min(1).max(10).optional(),
});

const reverseQuery = z.object({ lng, lat });

const categoryQuery = z.object({
  category: z.enum([...(Object.keys(CATEGORY_MAP) as (keyof typeof CATEGORY_MAP)[]), 'rnr']),
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
  const { q, lng, lat, limit } = searchQuery.parse(req.query);
  const near = lng !== undefined && lat !== undefined ? { lng, lat } : undefined;
  res.json({ results: await searchPlaces(q, near, limit) });
});

geocodingRouter.get('/reverse', async (req, res) => {
  const { lng, lat } = reverseQuery.parse(req.query);
  res.json({ result: await reverseGeocode({ lng, lat }) });
});

geocodingRouter.get('/along', async (req, res) => {
  const { category, points } = alongQuery.parse(req.query);
  res.json({ results: await searchAlong(category, points) });
});

geocodingRouter.get('/category', async (req, res) => {
  const { category, lng, lat, limit } = categoryQuery.parse(req.query);
  res.json({ results: await searchCategory(category, { lng, lat }, limit) });
});
