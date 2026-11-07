import { WifiOff } from 'lucide-react';
import { useVoiceLang } from '@/hooks/useVoiceAlerts';
import { useOnline } from '@/lib/connectivity';

/** Shown while navigating without internet: guidance keeps working on the saved route. */
export function OfflineBanner() {
  const online = useOnline();
  const [lang] = useVoiceLang();
  if (online) return null;
  return (
    <div role="status" className="pointer-events-auto flex items-start gap-2 rounded-2xl bg-ink-900/95 px-3 py-2 text-xs text-white shadow-float">
      <WifiOff className="mt-0.5 size-4 shrink-0 text-amber-400" />
      <span>
        {lang === 'ms'
          ? 'Tiada isyarat internet. Navigasi, suara dan GPS diteruskan dengan laluan tersimpan; laporan jalan & peta baharu menunggu isyarat.'
          : 'No internet. Directions, voice and GPS continue on the saved route; live reports and new map areas will wait for signal.'}
      </span>
    </div>
  );
}
