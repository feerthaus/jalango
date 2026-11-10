import { describe, expect, it } from 'vitest';
import { shareUrl } from './shareLinks';

const c = { title: 'JalanGo', text: 'Cuba JalanGo & elak jem!', url: 'https://jalango.netlify.app/?a=1' };

describe('shareUrl', () => {
  it('builds each platform link with the message encoded', () => {
    expect(shareUrl('whatsapp', c)).toBe('https://wa.me/?text=Cuba%20JalanGo%20%26%20elak%20jem!%20https%3A%2F%2Fjalango.netlify.app%2F%3Fa%3D1');
    expect(shareUrl('facebook', c)).toBe('https://www.facebook.com/sharer/sharer.php?u=https%3A%2F%2Fjalango.netlify.app%2F%3Fa%3D1');
    expect(shareUrl('telegram', c)).toContain('t.me/share/url?url=https%3A%2F%2Fjalango.netlify.app');
    expect(shareUrl('email', c)).toMatch(/^mailto:\?subject=JalanGo&body=/);
  });
});
