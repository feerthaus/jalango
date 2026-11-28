import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchLiveVersion, shortCommit } from './appVersion';

afterEach(() => vi.unstubAllGlobals());

describe('app version', () => {
  it('shortens commit hashes only', () => {
    expect(shortCommit('2eb9637313e83922edcce9aeffd4921fc1b6a96a')).toBe('2eb9637');
    expect(shortCommit('local')).toBe('local');
  });
  it('reads /version.json without the cache, and gives null when unknown', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ commit: 'abc1234def', builtAt: '2026-11-28T07:00:00Z' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    expect(await fetchLiveVersion()).toEqual({ commit: 'abc1234def', builtAt: '2026-11-28T07:00:00Z' });
    expect(fetchMock).toHaveBeenCalledWith(expect.stringMatching(/^\/version\.json\?t=\d+$/), expect.objectContaining({ cache: 'no-store' }));
    vi.stubGlobal('fetch', vi.fn(async () => new Response('not found', { status: 404 })));
    expect(await fetchLiveVersion()).toBeNull();
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>', { status: 200 })));
    expect(await fetchLiveVersion()).toBeNull();
  });
});
