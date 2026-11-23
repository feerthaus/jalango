import cors from 'cors';
import { weatherRouter } from './routes/weather.js';
import { assistantRouter } from './routes/assistant.js';
import express from 'express';
import helmet from 'helmet';
import { config, integrations } from './config.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import { rateLimit } from './middleware/rateLimit.js';
import { directionsRouter } from './routes/directions.js';
import { geocodingRouter } from './routes/geocoding.js';
import { transitRouter } from './routes/transit.js';
import { fuelRouter } from './routes/fuel.js';
import { probesRouter } from './routes/probes.js';
import { accountRouter, feedbackRouter } from './routes/account.js';
import { poiRouter } from './routes/poi.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(cors({ origin: config.corsOrigins }));
  // POI import batches (token only, off by default) need a bigger body than the rest of the API
  app.use('/api/poi', rateLimit({ name: 'poi-import', windowMs: 60_000, max: 30 }), poiRouter);
  app.use(express.json({ limit: '32kb' }));

  // Friendly landing for anyone who opens the API port in a browser
  app.get('/', (_req, res) => {
    res.json({
      name: 'JalanGo API',
      message: `This is the JalanGo API. Open the app at the web URL (${config.siteUrl}, or http://localhost:5173 in development).`,
      endpoints: ['/api/health', '/api/directions?from=lng,lat&to=lng,lat', 'POST /api/probes', '/api/geo/search?q=', '/api/geo/reverse?lng=&lat=', '/api/geo/category?category=&lng=&lat='],
    });
  });

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, integrations });
  });

  // Each along-route search fans out to up to 8 Mapbox calls
  app.use('/api/geo/along', rateLimit({ name: 'geo-along', windowMs: 60_000, max: 15 }));
  app.use('/api/geo/miss', rateLimit({ name: 'geo-miss', windowMs: 10 * 60_000, max: 20 }));
  app.use('/api/geo', rateLimit({ name: 'geo', windowMs: 60_000, max: 120 }), geocodingRouter);
  app.use('/api/fuel', rateLimit({ name: 'fuel', windowMs: 60_000, max: 30 }), fuelRouter);
  app.use('/api/weather', rateLimit({ name: 'weather', windowMs: 60_000, max: 30 }), weatherRouter);
  app.use('/api/transit', rateLimit({ name: 'transit', windowMs: 60_000, max: 30 }), transitRouter);
  app.use('/api/directions', rateLimit({ name: 'directions', windowMs: 60_000, max: 60 }), directionsRouter);
  app.use('/api/probes', rateLimit({ name: 'probes', windowMs: 60_000, max: 12 }), probesRouter);
  app.use('/api/account', rateLimit({ name: 'account', windowMs: 10 * 60_000, max: 5 }), accountRouter);
  app.use('/api/feedback', rateLimit({ name: 'feedback', windowMs: 10 * 60_000, max: 5 }), feedbackRouter);
  app.use('/api/assistant', rateLimit({ name: 'assistant', windowMs: 60_000, max: 6 }), assistantRouter);
  // Phase 3: app.use('/api/reports', reportsRouter)

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
