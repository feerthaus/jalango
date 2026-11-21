import { describe, expect, it } from 'vitest';
import { canType, QUICK, quickBody, quickMeta, spokenMessage } from './convoyChat';

describe('convoy chat helpers', () => {
  it('lets the driver type only when stopped or as a passenger', () => {
    expect(canType(0, false)).toBe(true);
    expect(canType(null, false)).toBe(true);
    expect(canType(2.5, false)).toBe(true);
    expect(canType(15, false)).toBe(false);
    expect(canType(15, true)).toBe(true);
  });
  it('quick calls match the database list and carry a position only for stops and hazards', () => {
    expect(QUICK.map((q) => q.id).sort()).toEqual(['arrived', 'food', 'fuel', 'hazard', 'ok', 'rest', 'slow', 'wait']);
    expect(QUICK.filter((q) => q.located).map((q) => q.id)).toEqual(['fuel', 'food', 'rest', 'hazard']);
    expect(quickBody('fuel', 'ms')).toBe('⛽ Singgah minyak');
    expect(quickMeta('nope')).toBeNull();
  });
  it('reads quick calls in the listener’s language and cuts long texts', () => {
    expect(spokenMessage('Ali', '⛽ Fuel stop', 'fuel', 'ms')).toBe('Ali: Singgah minyak');
    expect(spokenMessage('Ali', 'Jumpa di Ayer Keroh', null, 'ms')).toBe('Ali: Jumpa di Ayer Keroh');
    expect(spokenMessage('Ali', 'x'.repeat(200), null, 'en')).toHaveLength(5 + 118);
  });
});
