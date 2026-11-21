import { SITE_HOST } from '@/lib/site';
import { ArrowDown, ArrowUp, Check, Copy, Download, ExternalLink, MoreVertical, Share, SquarePlus, X } from 'lucide-react';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { LogoMark } from '@/components/brand/LogoMark';
import { Button } from '@/components/ui/Button';
import { useInstallPrompt } from '@/hooks/useInstallPrompt';
import { chromeIntentUrl } from '@/lib/installEnv';
import { useT } from '@/lib/i18n';

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
  const [t] = useT();
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
          <Download className="size-5" /> {t('Pasang JalanGo', 'Install JalanGo')}
        </Button>
      );
      break;
    case 'android-manual':
      body = (
        <ol className="space-y-3">
          {step(1, <>{t('Tekan', 'Tap')} <MoreVertical className="size-5" /> <strong>{t('menu', 'menu')}</strong> {t('di atas kanan Chrome', 'at the top right of Chrome')}</>)}
          {step(2, <>{t('Pilih', 'Choose')} <strong>{t('"Pasang aplikasi"', '"Install app"')}</strong> {t('atau', 'or')} <strong>{t('"Tambah ke skrin utama"', '"Add to Home screen"')}</strong></>)}
          {step(3, <>{t('Tekan', 'Tap')} <strong>{t('Pasang', 'Install')}</strong></>)}
        </ol>
      );
      arrow = 'up-right';
      break;
    case 'ios-safari':
      body = (
        <ol className="space-y-3">
          {step(1, <>{t('Tekan butang', 'Tap the')} <Share className="size-5 text-sky-500" /> <strong>{t('Kongsi', 'Share')}</strong> {t('di bawah skrin', 'button at the bottom of the screen')}</>)}
          {step(2, <>{t('Tatal ke bawah, pilih', 'Scroll down, choose')} <SquarePlus className="size-5" /> <strong>{t('"Tambah ke Skrin Utama"', '"Add to Home Screen"')}</strong></>)}
          {step(3, <>{t('Tekan', 'Tap')} <strong>{t('Tambah', 'Add')}</strong> {t('di atas kanan', 'at the top right')}</>)}
        </ol>
      );
      arrow = 'down';
      break;
    case 'ios-chrome':
      body = (
        <ol className="space-y-3">
          {step(1, <>{t('Tekan ikon', 'Tap the')} <Share className="size-5 text-sky-500" /> <strong>{t('Kongsi', 'Share')}</strong> {t('di', 'icon at the')} <strong>{t('sebelah kanan bar alamat', 'right of the address bar')}</strong> {t('(atas)', '(top)')}</>)}
          {step(2, <>{t('Pilih', 'Choose')} <SquarePlus className="size-5" /> <strong>{t('"Tambah ke Skrin Utama"', '"Add to Home Screen"')}</strong> {t('(tatal ke bawah jika tiada)', '(scroll down if you don’t see it)')}</>)}
          {step(3, <>{t('Tekan', 'Tap')} <strong>{t('Tambah', 'Add')}</strong></>)}
        </ol>
      );
      arrow = 'up-right';
      break;
    case 'ios-old':
      body = (
        <>
          <p className="text-[15px]">{t('iPhone anda hanya boleh menambah JalanGo ke skrin utama melalui', 'Your iPhone can only add JalanGo to the home screen from')} <strong>Safari</strong>{t('. Salin pautan dan buka dalam Safari.', '. Copy the link and open it in Safari.')}</p>
          <Button className="mt-3 w-full py-3" onClick={() => void copy()}>
            {copied ? <Check className="size-5" /> : <Copy className="size-5" />} {copied ? t('Pautan disalin', 'Link copied') : t('Salin pautan', 'Copy link')}
          </Button>
        </>
      );
      break;
    case 'inapp-android':
      body = (
        <>
          <p className="text-[15px]">{t('Anda sedang membuka JalanGo di dalam app lain (cth. WhatsApp, Facebook, Threads). Buka dalam', 'You’re viewing JalanGo inside another app (e.g. WhatsApp, Facebook, Threads). Open it in')} <strong>Chrome</strong> {t('untuk memasangnya.', 'to install it.')}</p>
          <a href={chromeIntentUrl(window.location.href)} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-jade-500 py-3 font-semibold text-white">
            <ExternalLink className="size-5" /> {t('Buka dalam Chrome', 'Open in Chrome')}
          </a>
        </>
      );
      break;
    case 'inapp-ios':
      body = (
        <>
          <p className="text-[15px]">{t('Anda sedang membuka JalanGo di dalam app lain (cth. Threads, Instagram, Facebook). Buka dalam', 'You’re viewing JalanGo inside another app (e.g. Threads, Instagram, Facebook). Open it in')} <strong>{t('Safari atau Chrome', 'Safari or Chrome')}</strong> {t('dahulu:', 'first:')}</p>
          <ol className="mt-3 space-y-3">
            {step(1, <>{t('Tekan', 'Tap')} <strong>⋯</strong> {t('atau ikon kompas/pelayar di sudut skrin', 'or the compass/browser icon in a corner of the screen')}</>)}
            {step(2, <>{t('Pilih', 'Choose')} <strong>{t('"Buka dalam pelayar"', '"Open in browser"')}</strong> / <strong>"Open in Safari"</strong></>)}
          </ol>
          <Button variant="secondary" className="mt-3 w-full py-3" onClick={() => void copy()}>
            {copied ? <Check className="size-5" /> : <Copy className="size-5" />} {copied ? t('Pautan disalin. Tampal dalam Safari.', 'Link copied. Paste it in Safari.') : t('Atau salin pautan', 'Or copy the link')}
          </Button>
        </>
      );
      break;
    default:
      body = <p className="text-[15px]">{t('Buka', 'Open')} <strong>{SITE_HOST}</strong> {t('di telefon anda (Chrome atau Safari) untuk memasang JalanGo.', 'on your phone (Chrome or Safari) to install JalanGo.')}</p>;
  }

  return createPortal(
    <div className="pointer-events-auto fixed inset-0 z-[70] flex items-end justify-center bg-ink-950/60" onClick={() => close(auto ? LATER_KEY : undefined)}>
      {arrow === 'down' && <ArrowDown className="absolute bottom-3 left-1/2 size-12 -translate-x-1/2 animate-bounce text-white drop-shadow-lg" aria-hidden />}
      {arrow === 'up-right' && <ArrowUp className="absolute right-4 top-3 size-12 animate-bounce text-white drop-shadow-lg" aria-hidden />}
      <div role="dialog" aria-modal="true" aria-label={t('Pasang JalanGo', 'Install JalanGo')} onClick={(e) => e.stopPropagation()} className={`w-full max-w-md animate-slide-up rounded-t-3xl bg-white p-5 shadow-float dark:bg-ink-900 ${arrow === 'down' ? 'mb-16 rounded-b-3xl' : 'safe-bottom'}`}>
        <div className="mb-4 flex items-start gap-3">
          <LogoMark className="size-14 shrink-0" />
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-black">{t('Pasang JalanGo', 'Install JalanGo')}</h2>
            <p className="text-sm text-ink-600 dark:text-ink-300">{t('Buka terus dari skrin utama macam app biasa: skrin penuh, lebih laju, tanpa bar pelayar.', 'Open it straight from your home screen like a normal app: full screen, faster, no browser bar.')}</p>
          </div>
          <button type="button" onClick={() => close(auto ? LATER_KEY : undefined)} aria-label={t('Tutup', 'Close')} className="grid size-9 shrink-0 place-items-center rounded-full hover:bg-ink-100 dark:hover:bg-ink-800">
            <X className="size-5" />
          </button>
        </div>
        {body}
        {auto && (
          <div className="mt-4 flex justify-between text-sm font-semibold text-ink-500">
            <button type="button" onClick={() => close(LATER_KEY)}>{t('Nanti dulu', 'Not now')}</button>
            <button type="button" onClick={() => close(NEVER_KEY)}>{t('Jangan tanya lagi', 'Don’t ask again')}</button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
