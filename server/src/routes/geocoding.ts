import { Router } from 'express';
import { z } from 'zod';
import { CATEGORY_MAP, reverseGeocode, searchCategory, searchPlaces } from '../services/mapbox.js';

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

geocodingRouter.get('/category', async (req, res) => {
  const { category, lng, lat, limit } = categoryQuery.parse(req.query);
  res.json({ results: await searchCategory(category, { lng, lat }, limit) });
});
