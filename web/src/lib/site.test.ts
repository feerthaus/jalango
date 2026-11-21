import { describe, expect, it } from 'vitest';
import { pageTitle } from '@/hooks/usePageMeta';
import { DEFAULT_SITE_URL, normaliseSiteUrl, robotsTxt, sitemapXml, SITEMAP_PATHS } from './sitePaths';

describe('site address', () => {
  it('normalises VITE_SITE_URL and falls back to the Netlify address', () => {
    expect(normaliseSiteUrl('https://jalango.my/')).toBe('https://jalango.my');
    expect(normaliseSiteUrl('  https://jalango.my  ')).toBe('https://jalango.my');
    expect(normaliseSiteUrl(undefined)).toBe(DEFAULT_SITE_URL);
    expect(normaliseSiteUrl('javascript:alert(1)')).toBe(DEFAULT_SITE_URL);
    expect(normaliseSiteUrl('https://jalango.my/path')).toBe(DEFAULT_SITE_URL);
  });
});

describe('robots.txt and sitemap.xml', () => {
  it('lets crawlers in, keeps private pages out, points at the sitemap', () => {
    const r = robotsTxt('https://jalango.my');
    expect(r).toContain('User-agent: *\nAllow: /');
    for (const p of ['/admin', '/api/', '/live/', '/business/listings/', '/profile', '/saved']) expect(r).toContain(`Disallow: ${p}`);
    expect(r).toContain('Sitemap: https://jalango.my/sitemap.xml');
  });
  it('lists the public pages with absolute URLs, the homepage first', () => {
    const x = sitemapXml('https://jalango.my', '2026-11-21');
    expect(x.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(x.match(/<loc>/g)).toHaveLength(SITEMAP_PATHS.length);
    expect(x.indexOf('<loc>https://jalango.my/home</loc>')).toBeLessThan(x.indexOf('<loc>https://jalango.my/</loc>'));
    expect(x).toContain('<lastmod>2026-11-21</lastmod>');
    expect(x).not.toContain('/admin');
  });
});

describe('page titles', () => {
  it('adds the app name after the page name', () => {
    expect(pageTitle('Sewa & Makan')).toBe('Sewa & Makan · JalanGo');
    expect(pageTitle(null)).toBe('JalanGo');
    expect(pageTitle('  ')).toBe('JalanGo');
  });
});
