import { Router } from 'express';
import { z } from 'zod';
import { CamerasUnavailable, camerasInTile } from '../services/cameras.js';

// Malaysia spans roughly x 199..238, y 1..14 on the 0.5° grid
const tileQuery = z.object({
  x: z.coerce.number().int().min(195).max(240),
  y: z.coerce.number().int().min(0).max(16),
});

export const camerasRouter = Router();

camerasRouter.get('/tile', async (req, res) => {
  const { x, y } = tileQuery.parse(req.query);
  let cameras;
  try {
    cameras = await camerasInTile(x, y);
  } catch (err) {
    if (!(err instanceof CamerasUnavailable)) throw err;
    // Camera data is a bonus: answer quickly so the app stops asking for a while
    res.setHeader('Cache-Control', 'public, max-age=600');
    res.json({ cameras: [], unavailable: true });
    return;
  }
  // Same URL for every driver in this area: let browsers and Netlify's CDN cache it
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.setHeader('Netlify-CDN-Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');
  res.json({ cameras, attribution: '© OpenStreetMap contributors' });
});
