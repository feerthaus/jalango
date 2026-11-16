import { TriangleAlert } from 'lucide-react';
import type { OncomingThreat } from '@/utils/oncoming';
import { useT } from '@/lib/i18n';

/** Big, high-contrast "don't overtake" warning (also spoken). */
export function OncomingBanner({ threat }: { threat: OncomingThreat }) {
  const [t] = useT();
  return (
    <div role="alert" className="pointer-events-auto flex animate-slide-up items-center gap-3 rounded-2xl bg-red-600 p-3 text-white shadow-float">
      <TriangleAlert className="size-9 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-lg font-black leading-tight">{t('JANGAN POTONG', 'DON’T OVERTAKE')}</p>
        <p className="text-sm font-semibold">{t('Kenderaan dari arah bertentangan · ~', 'Oncoming vehicle · ~')}{Math.round(threat.secondsToMeet)} s</p>
        <p className="text-[11px] opacity-80">{t('Eksperimen · hanya mengesan pengguna JalanGo', 'Experimental · only detects JalanGo users')}</p>
      </div>
    </div>
  );
}
