import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './index.css';
import { registerServiceWorker } from './lib/pwa';
import { initMonitoring } from './lib/monitoring';

initMonitoring();
registerServiceWorker();

// TEMPORARY (Netlify Free plan): Netlify injects a floating "Powered by Netlify"
// badge at the bottom right. Keep the tab bar, sheets and driving controls clear
// of it. Remove after upgrading the Netlify plan (AGENTS.md "Temporary workarounds").
if (document.querySelector('script[data-nf-variant]')) document.documentElement.classList.add('has-host-badge');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
