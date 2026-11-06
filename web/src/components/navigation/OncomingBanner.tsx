import { TriangleAlert } from 'lucide-react';
import type { OncomingThreat } from '@/utils/oncoming';

/** Big, high-contrast "don't overtake" warning (also spoken). */
export function OncomingBanner({ threat }: { threat: OncomingThreat }) {
  return (
    <div role="alert" className="pointer-events-auto flex animate-slide-up items-center gap-3 rounded-2xl bg-red-600 p-3 text-white shadow-float">
      <TriangleAlert className="size-9 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-lg font-black leading-tight">JANGAN POTONG</p>
        <p className="text-sm font-semibold">Kenderaan dari arah bertentangan · ~{Math.round(threat.secondsToMeet)} s</p>
        <p className="text-[11px] opacity-80">Eksperimen · hanya mengesan pengguna JalanGo</p>
      </div>
    </div>
  );
}
