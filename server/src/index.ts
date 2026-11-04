import { config, integrations } from './config.js';
import { createApp } from './app.js';

createApp().listen(config.port, () => {
  console.log(`[jalango] API listening on http://localhost:${config.port}`);
  console.log(`[jalango] Mapbox: ${integrations.mapbox ? 'configured' : 'NOT configured (clients fall back to demo mode)'}`);
});
