import { CloudLightning, CloudRain, X } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/cn';
import { useT } from '@/lib/i18n';
import type { WeatherWarning } from '@/services/weatherService';
import { STATE_NAMES, type StateCode } from '@/utils/malaysiaState';

const KEY = 'jalango:weather-dismissed';

function loadDismissed(): string[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as string[];
  } catch {
    return [];
  }
}

const until = (iso: string | null, lang: 'ms' | 'en') => {
  if (!iso) return '';
  const d = new Date(iso);
  const time = d.toLocaleTimeString(lang === 'ms' ? 'ms-MY' : 'en-MY', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kuala_Lumpur' });
  const sameDay = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kuala_Lumpur' }) === new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kuala_Lumpur' });
  const day = sameDay ? '' : ` ${d.toLocaleDateString(lang === 'ms' ? 'ms-MY' : 'en-MY', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Kuala_Lumpur' })}`;
  return lang === 'ms' ? `sehingga ${time}${day}` : `until ${time}${day}`;
};

/**
 * MetMalaysia warning for the states that matter here (where you are, and the
 * destination when planning). Tap to read the full text; X hides that warning.
 */
export function WeatherWarningBanner({ warnings, states, className }: { warnings: WeatherWarning[]; states: (StateCode | null)[]; className?: string }) {
  const [t, lang] = useT();
  const [dismissed, setDismissed] = useState<string[]>(loadDismissed);
  const [open, setOpen] = useState(false);
  const want = states.filter((s): s is StateCode => Boolean(s));
  const shown = warnings.filter((w) => !dismissed.includes(w.id) && w.states.some((s) => want.includes(s)));
  if (!shown.length) return null;
  // the most serious first: bad weather > rain > thunderstorm
  const order = { bad_weather: 0, rain: 1, thunderstorm: 2 } as const;
  const w = [...shown].sort((a, b) => order[a.kind] - order[b.kind])[0];
  const Icon = w.kind === 'thunderstorm' ? CloudLightning : CloudRain;
  const here = w.states.filter((s) => want.includes(s)).map((s) => STATE_NAMES[s]);

  const hide = () => {
    const next = [...dismissed, w.id].slice(-50);
    setDismissed(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* private mode: hidden until reload */
    }
  };

  return (
    <div role="status" className={cn('pointer-events-auto rounded-2xl bg-amber-400 text-ink-950 shadow-float', className)}>
      <div className="flex items-start gap-2 p-3">
        <Icon className="mt-0.5 size-5 shrink-0" />
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="min-w-0 flex-1 text-left">
          <span className="block text-sm font-bold leading-tight">
            {t(w.title_bm, w.title_en)} · {here.join(', ')}
          </span>
          <span className="block text-xs">
            {until(w.valid_to, lang)} {t('· MetMalaysia', '· MetMalaysia')}
            {shown.length > 1 && ` · ${t(`+${shown.length - 1} lagi`, `+${shown.length - 1} more`)}`}
          </span>
          {open && <span className="mt-1.5 block text-xs leading-snug">{t(w.text_bm, w.text_en)}</span>}
        </button>
        <button type="button" onClick={hide} aria-label={t('Tutup amaran', 'Dismiss warning')} className="grid size-8 shrink-0 place-items-center rounded-full hover:bg-ink-950/10">
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
