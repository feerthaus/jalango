import { describe, expect, it } from 'vitest';
import { isIOSWebKit } from './useWakeLock';

describe('isIOSWebKit', () => {
  it('spots iPhone (Safari and Chrome) and iPad, not Android or desktop Mac', () => {
    expect(isIOSWebKit('Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0 Mobile/15E148 Safari/604.1', 5)).toBe(true);
    expect(isIOSWebKit('Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 Version/18.1 Mobile/15E148 Safari/604.1', 5)).toBe(true);
    expect(isIOSWebKit('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.1 Safari/605.1.15', 5)).toBe(true); // iPadOS
    expect(isIOSWebKit('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.1 Safari/605.1.15', 0)).toBe(false);
    expect(isIOSWebKit('Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 Chrome/131.0 Mobile Safari/537.36', 5)).toBe(false);
  });
});
