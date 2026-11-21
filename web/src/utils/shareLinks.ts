import { SITE_URL } from '@/lib/site';
import { withUtm } from './attribution';

export interface ShareContent {
  /** Short title (used by email subject / native share) */
  title: string;
  /** Message without the link */
  text: string;
  url: string;
}

export type SharePlatform = 'whatsapp' | 'facebook' | 'telegram' | 'x' | 'threads' | 'email' | 'sms';

const enc = encodeURIComponent;

/**
 * Web links that open each app's own "share/compose" screen (no SDKs, no
 * trackers). Our own link gets utm_source=<platform>&utm_medium=share, so the
 * growth stats can tell which app a visitor came from (WhatsApp sends no referrer).
 */
export function shareUrl(platform: SharePlatform, content: ShareContent): string {
  const c = { ...content, url: withUtm(content.url, SITE_URL, platform) };
  const msg = `${c.text} ${c.url}`.trim();
  switch (platform) {
    case 'whatsapp':
      return `https://wa.me/?text=${enc(msg)}`;
    case 'facebook':
      return `https://www.facebook.com/sharer/sharer.php?u=${enc(c.url)}`;
    case 'telegram':
      return `https://t.me/share/url?url=${enc(c.url)}&text=${enc(c.text)}`;
    case 'x':
      return `https://x.com/intent/post?text=${enc(c.text)}&url=${enc(c.url)}`;
    case 'threads':
      return `https://www.threads.net/intent/post?text=${enc(msg)}`;
    case 'email':
      return `mailto:?subject=${enc(c.title)}&body=${enc(msg)}`;
    case 'sms':
      return `sms:?&body=${enc(msg)}`;
  }
}

/** The public address (from VITE_SITE_URL; see lib/site.ts). */
export { SITE_URL as APP_URL } from '@/lib/site';
