import { Download, Share, SquarePlus, X } from 'lucide-react';
import { useState } from 'react';
import { LogoMark } from '@/components/brand/LogoMark';
import { Button } from '@/components/ui/Button';
import { useInstallPrompt } from '@/hooks/useInstallPrompt';
import { InstallSheet } from './InstallSheet';

const DISMISS_KEY = 'jalango:install-dismissed';

function dismissedRecently(): boolean {
  try {
    const t = Number(localStorage.getItem(DISMISS_KEY));
    return Number.isFinite(t) && Date.now() - t < 7 * 86_400_000; // ask again after a week
  } catch {
    return false;
  }
}

/** Small, dismissible "Pasang JalanGo" card on the map; opens the full install guide. */
export function InstallBanner() {
  const { env } = useInstallPrompt();
  const [hidden, setHidden] = useState(dismissedRecently);
  const [open, setOpen] = useState(false);
  if (hidden || env === 'installed' || env === 'desktop') return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
    setHidden(true);
  };

  return (
    <div className="glass pointer-events-auto animate-slide-up rounded-2xl p-3 shadow-float ring-1 ring-ink-900/5 dark:ring-white/10">
      <div className="flex items-center gap-3">
        <LogoMark className="size-10" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Pasang JalanGo</p>
          <p className="text-xs text-ink-500 dark:text-ink-400">Skrin penuh, satu tekan dari skrin utama.</p>
        </div>
        <Button className="px-3 py-2 text-xs" onClick={() => setOpen(true)}>
          <Download className="size-4" /> Pasang
        </Button>
        <button type="button" onClick={dismiss} aria-label="Tutup" className="grid size-8 place-items-center rounded-full text-ink-400 hover:bg-ink-100 dark:hover:bg-ink-800">
          <X className="size-4" />
        </button>
      </div>
      {open && <InstallSheet onClose={() => setOpen(false)} />}
    </div>
  );
}

export function IosSteps() {
  return (
    <ol className="mt-3 space-y-2 rounded-xl bg-ink-100 p-3 text-sm dark:bg-ink-800">
      <li className="leading-relaxed [&_svg]:mx-0.5 [&_svg]:-mt-0.5">
        <span className="font-bold">1.</span> Tap <Share className="inline size-4 text-sky-500" /> <strong>Share</strong> in Safari’s toolbar
      </li>
      <li className="leading-relaxed [&_svg]:mx-0.5 [&_svg]:-mt-0.5">
        <span className="font-bold">2.</span> Choose <SquarePlus className="inline size-4" /> <strong>Add to Home Screen</strong>
      </li>
      <li className="leading-relaxed [&_svg]:mx-0.5 [&_svg]:-mt-0.5">
        <span className="font-bold">3.</span> Tap <strong>Add</strong>, then open JalanGo from your home screen
      </li>
    </ol>
  );
}
