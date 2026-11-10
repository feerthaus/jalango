import { describe, expect, it } from 'vitest';
import { cleanVoiceQuery } from './voiceQuery';

describe('cleanVoiceQuery', () => {
  it('drops what drivers say before the place', () => {
    expect(cleanVoiceQuery('Bawa saya ke Awana SkyWay')).toBe('Awana SkyWay');
    expect(cleanVoiceQuery('nak pergi KLCC tolong')).toBe('KLCC');
    expect(cleanVoiceQuery('Navigate to Petronas Gambang.')).toBe('Petronas Gambang');
    expect(cleanVoiceQuery('jom ke Pantai Cahaya Bulan')).toBe('Pantai Cahaya Bulan');
  });
  it('keeps place names that are only filler-looking words', () => {
    expect(cleanVoiceQuery('Jalan')).toBe('Jalan');
    expect(cleanVoiceQuery('Mid Valley')).toBe('Mid Valley');
    expect(cleanVoiceQuery('bawa saya ke Jalan Ampang')).toBe('Jalan Ampang');
  });
});
