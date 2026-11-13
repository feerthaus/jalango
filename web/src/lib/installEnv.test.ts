import { describe, expect, it } from 'vitest';
import { chromeIntentUrl, detectInstallEnv } from './installEnv';

const UA = {
  iosSafari: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.6 Mobile/15E148 Safari/604.1',
  iosChrome: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.54 Mobile/15E148 Safari/604.1',
  iosChromeOld: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/110.0 Mobile/15E148 Safari/604.1',
  iosThreads: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/22B83 Barcelona 361.0.0.30.89 (iPhone15,3; iOS 18_1; ms_MY)',
  iosInstagram: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 330.0.0.0',
  androidChrome: 'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
  androidFb: 'Mozilla/5.0 (Linux; Android 14; SM-S918B Build/UP1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/470.0.0.0;]',
  androidWebview: 'Mozilla/5.0 (Linux; Android 13; Pixel 7; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0 Mobile Safari/537.36',
  desktop: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
};
const d = (ua: string, hasPrompt = false, standalone = false) => detectInstallEnv(ua, { standalone, hasPrompt });

describe('detectInstallEnv', () => {
  it('tells iPhone browsers apart', () => {
    expect(d(UA.iosSafari)).toBe('ios-safari');
    expect(d(UA.iosChrome)).toBe('ios-chrome');
    expect(d(UA.iosChromeOld)).toBe('ios-old');
  });
  it('spots in-app browsers (Threads, Instagram, Facebook, Android WebView)', () => {
    expect(d(UA.iosThreads)).toBe('inapp-ios');
    expect(d(UA.iosInstagram)).toBe('inapp-ios');
    expect(d(UA.androidFb)).toBe('inapp-android');
    expect(d(UA.androidWebview)).toBe('inapp-android');
  });
  it('uses the one-tap prompt on Android when Chrome offers it', () => {
    expect(d(UA.androidChrome, true)).toBe('android-prompt');
    expect(d(UA.androidChrome, false)).toBe('android-manual');
    expect(d(UA.desktop)).toBe('desktop');
    expect(d(UA.iosSafari, false, true)).toBe('installed');
  });
  it('builds a Chrome intent link back to the same page', () => {
    expect(chromeIntentUrl('https://jalango.netlify.app/saved?x=1')).toBe(
      'intent://jalango.netlify.app/saved?x=1#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=https%3A%2F%2Fjalango.netlify.app%2Fsaved%3Fx%3D1;end',
    );
  });
});
