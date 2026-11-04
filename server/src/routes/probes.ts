import { Router } from 'express';
import { probeBatch, storeProbes } from '../services/probes.js';

export const probesRouter = Router();

probesRouter.post('/', async (req, res) => {
  const batch = probeBatch.parse(req.body);
  const result = await storeProbes(batch);
  res.status(202).json(result);
});
