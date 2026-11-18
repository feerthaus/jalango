import { useEffect, useState } from 'react';

/**
 * Keep the screen on while `active` (turn-by-turn), so the phone doesn't dim,
 * lock and suspend GPS.
 *
 * - Screen Wake Lock API; the phone may drop the lock at any time (a call, a
 *   notification, voice guidance on some iPhones), so it is asked for again
 *   when released, when the app comes back to the front, and every 15 s.
 * - Where that's missing or refused, a tiny silent video loops off screen:
 *   playing video keeps most phones awake (the classic NoSleep trick).
 * - Low Power Mode on iPhone refuses both: the state says so, and the screen
 *   shows how to keep it on.
 */
export type WakeState = 'off' | 'on' | 'fallback' | 'blocked';

// 2 s of black 16×16 H.264, no sound (made with ffmpeg)
const SILENT_MP4 = 'data:video/mp4;base64,AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAMrbW9vdgAAAGxtdmhkAAAAAAAAAAAAAAAAAAAD6AAAB9AAAQAAAQAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAlV0cmFrAAAAXHRraGQAAAADAAAAAAAAAAAAAAABAAAAAAAAB9AAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAABAAAAAQAAAAAAAkZWR0cwAAABxlbHN0AAAAAAAAAAEAAAfQAAAAAAABAAAAAAHNbWRpYQAAACBtZGhkAAAAAAAAAAAAAAAAAABAAAAAgABVxAAAAAAALWhkbHIAAAAAAAAAAHZpZGUAAAAAAAAAAAAAAABWaWRlb0hhbmRsZXIAAAABeG1pbmYAAAAUdm1oZAAAAAEAAAAAAAAAAAAAACRkaW5mAAAAHGRyZWYAAAAAAAAAAQAAAAx1cmwgAAAAAQAAAThzdGJsAAAAuHN0c2QAAAAAAAAAAQAAAKhhdmMxAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAABAAEABIAAAASAAAAAAAAAABFUxhdmM2MC4zMS4xMDIgbGlieDI2NAAAAAAAAAAAAAAAGP//AAAALmF2Y0MBQsAe/+EAFmdCwB7ZHsBEAAADAAQAAAMACDxYuSABAAVoy4PEyAAAABBwYXNwAAAAAQAAAAEAAAAUYnRydAAAAAAAAApQAAAKUAAAABhzdHRzAAAAAAAAAAEAAAACAABAAAAAABRzdHNzAAAAAAAAAAEAAAABAAAAHHN0c2MAAAAAAAAAAQAAAAEAAAACAAAAAQAAABxzdHN6AAAAAAAAAAAAAAACAAACiQAAAAsAAAAUc3RjbwAAAAAAAAABAAADWwAAAGJ1ZHRhAAAAWm1ldGEAAAAAAAAAIWhkbHIAAAAAAAAAAG1kaXJhcHBsAAAAAAAAAAAAAAAALWlsc3QAAAAlqXRvbwAAAB1kYXRhAAAAAQAAAABMYXZmNjAuMTYuMTAwAAAACGZyZWUAAAKcbWRhdAAAAnIGBf//btxF6b3m2Ui3lizYINkj7u94MjY0IC0gY29yZSAxNjQgcjMxMDggMzFlMTlmOSAtIEguMjY0L01QRUctNCBBVkMgY29kZWMgLSBDb3B5bGVmdCAyMDAzLTIwMjMgLSBodHRwOi8vd3d3LnZpZGVvbGFuLm9yZy94MjY0Lmh0bWwgLSBvcHRpb25zOiBjYWJhYz0wIHJlZj0zIGRlYmxvY2s9MTotMzotMyBhbmFseXNlPTB4MToweDExMSBtZT1oZXggc3VibWU9NyBwc3k9MSBwc3lfcmQ9Mi4wMDowLjcwIG1peGVkX3JlZj0xIG1lX3JhbmdlPTE2IGNocm9tYV9tZT0xIHRyZWxsaXM9MSA4eDhkY3Q9MCBjcW09MCBkZWFkem9uZT0yMSwxMSBmYXN0X3Bza2lwPTEgY2hyb21hX3FwX29mZnNldD0tNCB0aHJlYWRzPTEgbG9va2FoZWFkX3RocmVhZHM9MSBzbGljZWRfdGhyZWFkcz0wIG5yPTAgZGVjaW1hdGU9MSBpbnRlcmxhY2VkPTAgYmx1cmF5X2NvbXBhdD0wIGNvbnN0cmFpbmVkX2ludHJhPTAgYmZyYW1lcz0wIHdlaWdodHA9MCBrZXlpbnQ9MjUwIGtleWludF9taW49MSBzY2VuZWN1dD00MCBpbnRyYV9yZWZyZXNoPTAgcmNfbG9va2FoZWFkPTQwIHJjPWNyZiBtYnRyZWU9MSBjcmY9MjMuMCBxY29tcD0wLjYwIHFwbWluPTAgcXBtYXg9NjkgcXBzdGVwPTQgaXBfcmF0aW89MS40MCBhcT0xOjEuMjAAgAAAAA9liIQF85///w9FAAFXn4AAAAAHQZo4C+c6gA==';

const CHECK_MS = 15_000;

export function useWakeLock(active: boolean): WakeState {
  const [state, setState] = useState<WakeState>('off');

  useEffect(() => {
    if (!active) {
      setState('off');
      return;
    }
    let lock: WakeLockSentinel | null = null;
    let video: HTMLVideoElement | null = null;
    let stopped = false;

    const startVideo = async (): Promise<boolean> => {
      try {
        if (!video) {
          video = document.createElement('video');
          video.setAttribute('playsinline', '');
          video.setAttribute('muted', '');
          video.muted = true;
          video.loop = true;
          video.src = SILENT_MP4;
          video.setAttribute('aria-hidden', 'true');
          Object.assign(video.style, { position: 'fixed', width: '1px', height: '1px', opacity: '0.01', pointerEvents: 'none', left: '0', top: '0' });
          document.body.appendChild(video);
        }
        await video.play();
        return true;
      } catch {
        return false;
      }
    };

    const acquire = async () => {
      if (stopped || document.visibilityState !== 'visible') return;
      if ('wakeLock' in navigator) {
        if (lock && !lock.released) return;
        try {
          lock = await navigator.wakeLock.request('screen');
          if (stopped) return void lock.release().catch(() => {});
          lock.addEventListener('release', () => {
            // dropped by the phone, not by us: ask again shortly
            if (!stopped) window.setTimeout(() => void acquire(), 1000);
          });
          setState('on');
          return;
        } catch {
          /* refused (e.g. Low Power Mode): try the video */
        }
      }
      setState((await startVideo()) ? 'fallback' : 'blocked');
    };

    const onVisible = () => void acquire();
    void acquire();
    document.addEventListener('visibilitychange', onVisible);
    const watchdog = window.setInterval(() => {
      if (lock && !lock.released) return;
      if (video && !video.paused) return;
      void acquire();
    }, CHECK_MS);

    return () => {
      stopped = true;
      window.clearInterval(watchdog);
      document.removeEventListener('visibilitychange', onVisible);
      void lock?.release().catch(() => {});
      if (video) {
        video.pause();
        video.remove();
      }
    };
  }, [active]);

  return state;
}
