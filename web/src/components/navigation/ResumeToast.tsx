import { History, X } from 'lucide-react';
import { useRouting } from '@/contexts/RoutingContext';
import { useVoiceLang } from '@/hooks/useVoiceAlerts';

/** "Continuing your trip to …" after the app reopens, with a way to cancel. */
export function ResumeToast({ className = '' }: { className?: string }) {
  const { resumedTo, dismissResumed, endNavigation } = useRouting();
  const [lang] = useVoiceLang();
  if (!resumedTo) return null;
  return (
    <div role="status" className={`pointer-events-auto flex animate-slide-up ${className} items-center gap-3 rounded-2xl bg-ink-950 p-3 pl-4 text-white shadow-float`}>
      <History className="size-5 shrink-0 text-jade-400" />
      <p className="min-w-0 flex-1 text-sm">
        {lang === 'ms' ? 'Menyambung perjalanan ke' : 'Continuing your trip to'} <strong className="font-semibold">{resumedTo}</strong>
      </p>
      <button type="button" onClick={endNavigation} className="rounded-lg px-2 py-1 text-sm font-semibold text-jade-300 hover:bg-white/10">
        {lang === 'ms' ? 'Batal' : 'Cancel'}
      </button>
      <button type="button" onClick={dismissResumed} aria-label="Dismiss" className="grid size-8 place-items-center rounded-full text-ink-300 hover:bg-white/10">
        <X className="size-4" />
      </button>
    </div>
  );
}
