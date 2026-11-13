import { ArrowDown, ArrowUp, Check, Copy, Download, ExternalLink, MoreVertical, Share, SquarePlus, X } from 'lucide-react';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { LogoMark } from '@/components/brand/LogoMark';
import { Button } from '@/components/ui/Button';
import { useInstallPrompt } from '@/hooks/useInstallPrompt';
import { chromeIntentUrl } from '@/lib/installEnv';

const NEVER_KEY = 'jalango:install-never';
const LATER_KEY = 'jalango:install-later';

export function installSnoozed(): boolean {
  try {
    if (localStorage.getItem(NEVER_KEY)) return true;
    const t = Number(localStorage.getItem(LATER_KEY));
    return Number.isFinite(t) && Date.now() - t < 3 * 86_400_000;
  } catch {
    return false;
  }
}
function remember(key: string) {
  try {
    localStorage.setItem(key, String(Date.now()));
  } catch {
    /* ignore */
  }
}

/** "Pasang JalanGo": the right add-to-home-screen path for this phone and browser. */
export function InstallSheet({ onClose, auto = false }: { onClose: () => void; auto?: boolean }) {
  const { env, install } = useInstallPrompt();
  const [copied, setCopied] = useState(false);
  const close = (key?: string) => {
    if (key) remember(key);
    onClose();
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
    } catch {
      /* ignore */
    }
  };

  const step = (n: number, body: React.ReactNode) => (
    <li className="flex items-start gap-3">
      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-jade-500 text-sm font-black text-white">{n}</span>
      <span className="pt-0.5 text-[15px] leading-snug [&_svg]:mx-0.5 [&_svg]:-mt-0.5 [&_svg]:inline">{body}</span>
    </li>
  );

  let body: React.ReactNode;
  let arrow: 'up-right' | 'down' | null = null;
  switch (env) {
    case 'android-prompt':
      body = (
        <Button className="w-full py-4 text-base" onClick={async () => (await install()) ? close() : undefined}>
          <Download className="size-5" /> Pasang JalanGo
        </Button>
      );
      break;
    case 'android-manual':
      body = (
        <ol className="space-y-3">
          {step(1, <>Tekan <MoreVertical className="size-5" /> <strong>menu</strong> di atas kanan Chrome</>)}
          {step(2, <>Pilih <strong>"Pasang aplikasi"</strong> atau <strong>"Tambah ke skrin utama"</strong></>)}
          {step(3, <>Tekan <strong>Pasang</strong></>)}
        </ol>
      );
      arrow = 'up-right';
      break;
    case 'ios-safari':
      body = (
        <ol className="space-y-3">
          {step(1, <>Tekan butang <Share className="size-5 text-sky-500" /> <strong>Kongsi</strong> di bawah skrin</>)}
          {step(2, <>Tatal ke bawah, pilih <SquarePlus className="size-5" /> <strong>"Tambah ke Skrin Utama"</strong></>)}
          {step(3, <>Tekan <strong>Tambah</strong> di atas kanan</>)}
        </ol>
      );
      arrow = 'down';
      break;
    case 'ios-chrome':
      body = (
        <ol className="space-y-3">
          {step(1, <>Tekan ikon <Share className="size-5 text-sky-500" /> <strong>Kongsi</strong> di <strong>sebelah kanan bar alamat</strong> (atas)</>)}
          {step(2, <>Pilih <SquarePlus className="size-5" /> <strong>"Tambah ke Skrin Utama"</strong> (tatal ke bawah jika tiada)</>)}
          {step(3, <>Tekan <strong>Tambah</strong></>)}
        </ol>
      );
      arrow = 'up-right';
      break;
    case 'ios-old':
      body = (
        <>
          <p className="text-[15px]">iPhone anda hanya boleh menambah JalanGo ke skrin utama melalui <strong>Safari</strong>. Salin pautan dan buka dalam Safari.</p>
          <Button className="mt-3 w-full py-3" onClick={() => void copy()}>
            {copied ? <Check className="size-5" /> : <Copy className="size-5" />} {copied ? 'Pautan disalin' : 'Salin pautan'}
          </Button>
        </>
      );
      break;
    case 'inapp-android':
      body = (
        <>
          <p className="text-[15px]">Anda sedang membuka JalanGo di dalam app lain (cth. WhatsApp, Facebook, Threads). Buka dalam <strong>Chrome</strong> untuk memasangnya.</p>
          <a href={chromeIntentUrl(window.location.href)} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-jade-500 py-3 font-semibold text-white">
            <ExternalLink className="size-5" /> Buka dalam Chrome
          </a>
        </>
      );
      break;
    case 'inapp-ios':
      body = (
        <>
          <p className="text-[15px]">Anda sedang membuka JalanGo di dalam app lain (cth. Threads, Instagram, Facebook). Buka dalam <strong>Safari atau Chrome</strong> dahulu:</p>
          <ol className="mt-3 space-y-3">
            {step(1, <>Tekan <strong>⋯</strong> atau ikon kompas/pelayar di sudut skrin</>)}
            {step(2, <>Pilih <strong>"Buka dalam pelayar"</strong> / <strong>"Open in Safari"</strong></>)}
          </ol>
          <Button variant="secondary" className="mt-3 w-full py-3" onClick={() => void copy()}>
            {copied ? <Check className="size-5" /> : <Copy className="size-5" />} {copied ? 'Pautan disalin. Tampal dalam Safari.' : 'Atau salin pautan'}
          </Button>
        </>
      );
      break;
    default:
      body = <p className="text-[15px]">Buka <strong>jalango.netlify.app</strong> di telefon anda (Chrome atau Safari) untuk memasang JalanGo.</p>;
  }

  return createPortal(
    <div className="pointer-events-auto fixed inset-0 z-[70] flex items-end justify-center bg-ink-950/60" onClick={() => close(auto ? LATER_KEY : undefined)}>
      {arrow === 'down' && <ArrowDown className="absolute bottom-3 left-1/2 size-12 -translate-x-1/2 animate-bounce text-white drop-shadow-lg" aria-hidden />}
      {arrow === 'up-right' && <ArrowUp className="absolute right-4 top-3 size-12 animate-bounce text-white drop-shadow-lg" aria-hidden />}
      <div role="dialog" aria-modal="true" aria-label="Pasang JalanGo" onClick={(e) => e.stopPropagation()} className={`w-full max-w-md animate-slide-up rounded-t-3xl bg-white p-5 shadow-float dark:bg-ink-900 ${arrow === 'down' ? 'mb-16 rounded-b-3xl' : 'safe-bottom'}`}>
        <div className="mb-4 flex items-start gap-3">
          <LogoMark className="size-14 shrink-0" />
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-black">Pasang JalanGo</h2>
            <p className="text-sm text-ink-600 dark:text-ink-300">Buka terus dari skrin utama macam app biasa: skrin penuh, lebih laju, tanpa bar pelayar.</p>
          </div>
          <button type="button" onClick={() => close(auto ? LATER_KEY : undefined)} aria-label="Tutup" className="grid size-9 shrink-0 place-items-center rounded-full hover:bg-ink-100 dark:hover:bg-ink-800">
            <X className="size-5" />
          </button>
        </div>
        {body}
        {auto && (
          <div className="mt-4 flex justify-between text-sm font-semibold text-ink-500">
            <button type="button" onClick={() => close(LATER_KEY)}>Nanti dulu</button>
            <button type="button" onClick={() => close(NEVER_KEY)}>Jangan tanya lagi</button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
