import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { config, integrations } from './config.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import { rateLimit } from './middleware/rateLimit.js';
import { geocodingRouter } from './routes/geocoding.js';

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
      endpoints: ['/api/health', '/api/geo/search?q=', '/api/geo/reverse?lng=&lat=', '/api/geo/category?category=&lng=&lat='],
    });
  });

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, integrations });
  });

  app.use('/api/geo', rateLimit({ windowMs: 60_000, max: 120 }), geocodingRouter);
  // Phase 2: app.use('/api/directions', directionsRouter)
  // Phase 3: app.use('/api/reports', reportsRouter)

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
