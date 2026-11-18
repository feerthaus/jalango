import type { Lang } from '@/lib/i18n';

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds)) return '–';
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${Math.max(1, mins)} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** "5 min lalu" / "5 min ago" in the app language; older than a day → "18 Nov". */
export function formatRelativeTime(iso: string, lang: Lang, now = Date.now()): string {
  const diff = Math.round((now - new Date(iso).getTime()) / 1000);
  const ms = lang === 'ms';
  if (diff < 45) return ms ? 'baru tadi' : 'just now';
  if (diff < 3600) return ms ? `${Math.round(diff / 60)} min lalu` : `${Math.round(diff / 60)} min ago`;
  if (diff < 86_400) return ms ? `${Math.round(diff / 3600)} jam lalu` : `${Math.round(diff / 3600)} h ago`;
  return new Date(iso).toLocaleDateString(ms ? 'ms-MY' : 'en-MY', { day: 'numeric', month: 'short' });
}

/** Lower-case, strip accents & punctuation for fuzzy matching. */
export function normalizeText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
