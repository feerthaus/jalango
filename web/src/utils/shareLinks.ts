export interface ShareContent {
  /** Short title (used by email subject / native share) */
  title: string;
  /** Message without the link */
  text: string;
  url: string;
}

export type SharePlatform = 'whatsapp' | 'facebook' | 'telegram' | 'x' | 'threads' | 'email' | 'sms';

const enc = encodeURIComponent;

/** Web links that open each app's own "share/compose" screen (no SDKs, no tracking). */
export function shareUrl(platform: SharePlatform, c: ShareContent): string {
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

export const APP_URL = 'https://jalango.netlify.app';
