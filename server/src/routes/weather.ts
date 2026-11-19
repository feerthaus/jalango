import { Router } from 'express';
import { getWeatherWarnings } from '../services/weather.js';

export const weatherRouter = Router();

/** Current MetMalaysia land warnings (thunderstorm, rain, bad weather) with the states they cover. */
weatherRouter.get('/warnings', async (_req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.json({ warnings: await getWeatherWarnings(), source: 'MetMalaysia via data.gov.my' });
});
