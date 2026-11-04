import { MapPinned, ShieldAlert, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { useLocation } from '@/contexts/LocationContext';
import type { GeoStatus } from '@/types';

const MESSAGES: Partial<Record<GeoStatus, { title: string; body: string; retry: boolean }>> = {
  prompt: {
    title: 'Use your location?',
    body: 'JalanGo needs GPS to show where you are and, later, to navigate. Your location stays on this device.',
    retry: true,
  },
  denied: {
    title: 'Location access is blocked',
    body: 'Allow location for this site in your browser settings (tap the 🔒 icon in the address bar), then try again.',
    retry: true,
  },
  unavailable: {
    title: 'Can’t get a GPS fix',
    body: 'Your device couldn’t determine its position. Move to an open area or check that location services are on.',
    retry: true,
  },
  timeout: {
    title: 'Still looking for GPS…',
    body: 'This is taking longer than usual. We’ll keep trying in the background.',
    retry: true,
  },
  unsupported: {
    title: 'GPS not supported',
    body: 'This browser does not support geolocation. You can still search and browse the map.',
    retry: false,
  },
  insecure: {
    title: 'Location needs HTTPS',
    body: 'Browsers only share location with secure (https://) pages. Open JalanGo over HTTPS or on localhost.',
    retry: false,
  },
};

export function LocationStatusBanner() {
  const { status, request } = useLocation();
  const [dismissed, setDismissed] = useState<GeoStatus | null>(null);
  const msg = MESSAGES[status];
  if (!msg || dismissed === status) return null;

  const Icon = status === 'prompt' ? MapPinned : ShieldAlert;
  return (
    <div role="status" className="glass pointer-events-auto flex animate-slide-up items-start gap-3 rounded-2xl p-3 shadow-float ring-1 ring-ink-900/5 dark:ring-white/10">
      <span className={status === 'prompt' ? 'text-jade-600 dark:text-jade-400' : 'text-amber-500'}>
        <Icon className="mt-0.5 size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{msg.title}</p>
        <p className="mt-0.5 text-xs text-ink-500 dark:text-ink-300">{msg.body}</p>
        {msg.retry && (
          <Button className="mt-2 px-3 py-1.5 text-xs" onClick={request}>
            {status === 'prompt' ? 'Enable location' : 'Try again'}
          </Button>
        )}
      </div>
      <button type="button" aria-label="Dismiss" onClick={() => setDismissed(status)} className="grid size-8 place-items-center rounded-full text-ink-400 hover:bg-ink-100 dark:hover:bg-ink-800">
        <X className="size-4" />
      </button>
    </div>
  );
}
