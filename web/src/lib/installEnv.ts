/**
 * Which "add to home screen" path this browser has:
 *  - android-prompt: Chrome/Edge/Samsung gave us beforeinstallprompt → one tap
 *  - android-manual: Android browser without the prompt (yet) → menu ⋮ → Install / Add to Home screen
 *  - ios-safari: Share (bottom bar) → Add to Home Screen
 *  - ios-chrome: Share icon in the address bar (top right) → Add to Home Screen (iOS 16.4+)
 *  - ios-old: iOS < 16.4 in a non-Safari browser → only Safari can add
 *  - inapp-android / inapp-ios: inside WhatsApp, Threads, Instagram, Facebook, TikTok… → open in a real browser first
 *  - desktop / installed
 */
export type InstallEnv = 'installed' | 'android-prompt' | 'android-manual' | 'ios-safari' | 'ios-chrome' | 'ios-old' | 'inapp-android' | 'inapp-ios' | 'desktop';

const INAPP = /FBAN|FBAV|FB_IAB|Instagram|Barcelona|Threads|TikTok|musical_ly|Bytedance|Line\/|Snapchat|Twitter|LinkedInApp|GSA\//i;

export function iosVersion(ua: string): number | null {
  const m = ua.match(/OS (\d+)[_.](\d+)/);
  return m ? Number(m[1]) + Number(m[2]) / 100 : null;
}

export function detectInstallEnv(ua: string, opts: { standalone: boolean; hasPrompt: boolean; touchMac?: boolean }): InstallEnv {
  if (opts.standalone) return 'installed';
  const ios = /iPad|iPhone|iPod/.test(ua) || Boolean(opts.touchMac);
  const android = /Android/i.test(ua);
  const inapp = INAPP.test(ua) || (android && /; wv\)/.test(ua));
  if (inapp) return ios ? 'inapp-ios' : android ? 'inapp-android' : 'desktop';
  if (ios) {
    const otherBrowser = /CriOS|EdgiOS|FxiOS|OPiOS/.test(ua);
    if (!otherBrowser) return 'ios-safari';
    const v = iosVersion(ua);
    return v !== null && v < 16.4 ? 'ios-old' : 'ios-chrome';
  }
  if (android) return opts.hasPrompt ? 'android-prompt' : 'android-manual';
  return opts.hasPrompt ? 'android-prompt' : 'desktop';
}

/** Android: open this page in Chrome from an in-app browser. */
export function chromeIntentUrl(href: string): string {
  const u = new URL(href);
  return `intent://${u.host}${u.pathname}${u.search}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(href)};end`;
}
