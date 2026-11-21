import { useEffect } from 'react';
import { useLocation } from 'react-router';
import { absoluteUrl } from '@/lib/site';

export interface PageMeta {
  /** Page name ("Sewa & Makan"); null for the app's own name */
  title: string | null;
  /** One or two sentences for search results; defaults to the app description */
  description?: string;
  /** Path for the canonical URL; defaults to the current path (query string dropped) */
  canonicalPath?: string;
  /** Private or per-person pages: tell search engines not to index them */
  noindex?: boolean;
}

export const DEFAULT_TITLE = 'JalanGo';

/** "Sewa & Makan" → "Sewa & Makan · JalanGo"; null → "JalanGo". */
export function pageTitle(title: string | null | undefined): string {
  const t = title?.trim();
  return t ? `${t} · ${DEFAULT_TITLE}` : DEFAULT_TITLE;
}

/** Find or create <meta name|property=…> / <link rel=…> in <head>. */
function headTag(selector: string, create: () => HTMLElement): HTMLElement {
  return document.head.querySelector<HTMLElement>(selector) ?? document.head.appendChild(create());
}
function setMeta(attr: 'name' | 'property', key: string, content: string | null) {
  const el = headTag(`meta[${attr}="${key}"]`, () => {
    const m = document.createElement('meta');
    m.setAttribute(attr, key);
    return m;
  });
  if (content === null) el.remove();
  else el.setAttribute('content', content);
}

/** The description index.html ships with, kept for pages that don't give their own. */
let defaultDescription: string | null = null;

/**
 * Title, description, canonical URL and robots for this page. It's a
 * single-page app, so this runs in the browser: search engines that run
 * JavaScript (Google) see it; link previews (WhatsApp, Facebook) use the
 * defaults in index.html.
 */
export function usePageMeta({ title, description, canonicalPath, noindex = false }: PageMeta): void {
  const { pathname } = useLocation();
  const path = canonicalPath ?? pathname;
  useEffect(() => {
    if (typeof document === 'undefined') return;
    defaultDescription ??= document.head.querySelector('meta[name="description"]')?.getAttribute('content') ?? '';
    const desc = description?.trim() || defaultDescription;
    document.title = pageTitle(title);
    setMeta('name', 'description', desc);
    setMeta('property', 'og:title', pageTitle(title));
    setMeta('property', 'og:description', desc);
    setMeta('property', 'og:url', absoluteUrl(path));
    setMeta('name', 'robots', noindex ? 'noindex, nofollow' : null);
    const canonical = headTag('link[rel="canonical"]', () => {
      const l = document.createElement('link');
      l.setAttribute('rel', 'canonical');
      return l;
    });
    if (noindex) canonical.remove();
    else canonical.setAttribute('href', absoluteUrl(path));
  }, [title, description, path, noindex]);
}
