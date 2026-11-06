import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './index.css';
import { registerServiceWorker } from './lib/pwa';

registerServiceWorker();

// Free-tier hosts may inject a floating badge at the bottom of the page; keep our
// critical driving controls (End, directions) clear of it.
if (document.querySelector('script[data-nf-variant]')) document.documentElement.classList.add('has-host-badge');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
