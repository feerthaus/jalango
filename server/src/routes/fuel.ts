import { Router } from 'express';
import { getFuelPrices } from '../services/fuel.js';

export const fuelRouter = Router();

fuelRouter.get('/', async (_req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.json(await getFuelPrices());
});
