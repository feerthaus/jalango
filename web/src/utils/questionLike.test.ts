import { describe, expect, it } from 'vitest';
import { looksLikeQuestion } from './questionLike';

describe('looksLikeQuestion', () => {
  it('spots trip questions in Malay and English', () => {
    expect(looksLikeQuestion('Nak ke kedai makan palag best di KL')).toBe(true);
    expect(looksLikeQuestion('cara paling murah ke KLIA')).toBe(true);
    expect(looksLikeQuestion('ke KLCC naik apa?')).toBe(true);
    expect(looksLikeQuestion('what is the fastest way to Ipoh')).toBe(true);
  });
  it('leaves place names and addresses alone', () => {
    expect(looksLikeQuestion('Pavilion Bukit Bintang')).toBe(false);
    expect(looksLikeQuestion('Stesen KTM Gemas')).toBe(false);
    expect(looksLikeQuestion('Jalan Tun Razak Kuala Lumpur')).toBe(false);
    expect(looksLikeQuestion('Restoran Nasi Kandar Pelita Jalan Ampang')).toBe(false);
    expect(looksLikeQuestion('kfc')).toBe(false);
  });
});
