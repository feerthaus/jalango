import { describe, expect, it } from 'vitest';
import { classifyVisit, cleanLanding, cleanTag, withUtm } from './attribution';

const visit = (search: string, referrer = '', path = '/home') => classifyVisit({ search, referrer, path, ownHost: 'jalango.netlify.app' });

describe('classifyVisit', () => {
  it('trusts utm tags first, with common spellings', () => {
    expect(visit('?utm_source=TikTok&utm_medium=bio&utm_campaign=Raya 2027')).toMatchObject({ source: 'tiktok', medium: 'bio', campaign: 'raya-2027' });
    expect(visit('?utm_source=wa&utm_medium=broadcast')).toMatchObject({ source: 'whatsapp', medium: 'broadcast' });
    expect(visit('?utm_source=ig&utm_medium=cpc')).toMatchObject({ source: 'instagram', medium: 'paid' });
    expect(visit('?utm_source=koran-kampung')).toMatchObject({ source: 'other', medium: 'none' });
  });
  it('names the channel from ad click IDs without keeping them', () => {
    const g = visit('?gclid=abc123');
    expect(g).toMatchObject({ source: 'google', medium: 'paid' });
    expect(JSON.stringify(g)).not.toContain('abc123');
    expect(visit('?ttclid=x')).toMatchObject({ source: 'tiktok', medium: 'paid' });
    expect(visit('?fbclid=x', 'https://l.instagram.com/')).toMatchObject({ source: 'instagram' });
    expect(visit('?fbclid=x', 'https://lm.facebook.com/')).toMatchObject({ source: 'facebook', medium: 'social' });
  });
  it('reads the referring site', () => {
    expect(visit('', 'https://www.google.com.my/')).toMatchObject({ source: 'google', medium: 'organic', refDomain: 'google.com.my' });
    expect(visit('', 'https://m.facebook.com/')).toMatchObject({ source: 'facebook', medium: 'social' });
    expect(visit('', 'https://www.tiktok.com/@jalango')).toMatchObject({ source: 'tiktok', medium: 'social', refDomain: 'tiktok.com' });
    expect(visit('', 'https://t.co/xyz')).toMatchObject({ source: 'x' });
    expect(visit('', 'https://duckduckgo.com/')).toMatchObject({ source: 'search_other' });
    expect(visit('', 'https://blog.contoh.my/post/123?id=9')).toMatchObject({ source: 'referral', medium: 'referral', refDomain: 'blog.contoh.my' });
  });
  it('is direct with no signal, or when the referrer is JalanGo itself', () => {
    expect(visit('')).toMatchObject({ source: 'direct', medium: 'none', refDomain: null });
    expect(visit('', 'https://jalango.netlify.app/home')).toMatchObject({ source: 'direct', refDomain: null });
  });
  it('keeps only a short, safe landing path', () => {
    expect(visit('', '', '/sewa/abc-123/extra?x=1').landing).toBe('/sewa/abc-123');
    expect(cleanLanding('/<script>')).toBe('/script');
    expect(cleanLanding('')).toBe('/');
    expect(cleanTag('  Hari Raya!! 2027 ')).toBe('hari-raya-2027');
    expect(cleanTag('')).toBeNull();
  });
});

describe('withUtm', () => {
  const site = 'https://jalango.netlify.app';
  it('tags our links, not other sites', () => {
    expect(withUtm(`${site}/home`, site, 'whatsapp')).toBe(`${site}/home?utm_source=whatsapp&utm_medium=share`);
    expect(withUtm(`${site}/?tempat=3.1,101.7`, site, 'x')).toBe(`${site}/?tempat=3.1%2C101.7&utm_source=x&utm_medium=share`);
    expect(withUtm('https://maps.google.com/?q=1', site, 'whatsapp')).toBe('https://maps.google.com/?q=1');
    expect(withUtm(`${site}/home?utm_source=tiktok`, site, 'whatsapp')).toBe(`${site}/home?utm_source=tiktok`);
  });
});
