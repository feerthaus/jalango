import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { config, integrations } from './config.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import { rateLimit } from './middleware/rateLimit.js';
import { directionsRouter } from './routes/directions.js';
import { geocodingRouter } from './routes/geocoding.js';
import { probesRouter } from './routes/probes.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(cors({ origin: config.corsOrigins }));
  app.use(express.json({ limit: '32kb' }));

  // Friendly landing for anyone who opens the API port in a browser
  app.get('/', (_req, res) => {
    res.json({
      name: 'JalanGo API',
      message: 'This is the API server. Open the app at the web URL (http://localhost:5173 in development).',
      endpoints: ['/api/health', '/api/directions?from=lng,lat&to=lng,lat', 'POST /api/probes', '/api/geo/search?q=', '/api/geo/reverse?lng=&lat=', '/api/geo/category?category=&lng=&lat='],
    });
  });

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, integrations });
  });

  app.use('/api/geo', rateLimit({ windowMs: 60_000, max: 120 }), geocodingRouter);
  app.use('/api/directions', rateLimit({ windowMs: 60_000, max: 60 }), directionsRouter);
  app.use('/api/probes', rateLimit({ windowMs: 60_000, max: 12 }), probesRouter);
  // Phase 3: app.use('/api/reports', reportsRouter)

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
