import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('12Go partner links', () => {
  it('no link until the affiliate ID is set', async () => {
    vi.stubEnv('VITE_TWELVEGO_ID', '');
    const { twelveGoTrainUrl } = await import('./partners');
    expect(twelveGoTrainUrl('KL Sentral', 'Ipoh')).toBeNull();
  });

  it('route page between known cities, KTM page otherwise', async () => {
    vi.stubEnv('VITE_TWELVEGO_ID', '123456');
    const { twelveGoTrainUrl, twelveGoCity } = await import('./partners');
    expect(twelveGoTrainUrl('KL Sentral', 'Ipoh')).toBe('https://12go.asia/en/travel/kuala-lumpur/ipoh?z=123456');
    expect(twelveGoTrainUrl('Kuala Lumpur', 'JB Sentral', 'ms')).toBe('https://12go.asia/ms/travel/kuala-lumpur/johor-bahru?z=123456');
    expect(twelveGoTrainUrl('Tanjong Malim', 'Ipoh')).toBe('https://12go.asia/en/operator/ktm?z=123456');
    expect(twelveGoCity('Wakaf Bharu')).toBe('kota-bharu');
  });

  it('keeps only safe characters in the ID', async () => {
    vi.stubEnv('VITE_TWELVEGO_ID', ' 12"34<script> ');
    const { TWELVEGO_ID } = await import('./partners');
    expect(TWELVEGO_ID).toBe('1234script');
  });
});
