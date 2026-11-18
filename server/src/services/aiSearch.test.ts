import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../config.js', () => ({ config: { anthropicKey: 'test-key' }, integrations: {} }));
const parse = vi.hoisted(() => vi.fn());
vi.mock('@anthropic-ai/sdk', async (orig) => {
  const real = await orig<typeof import('@anthropic-ai/sdk')>();
  class Fake {
    messages = { parse };
    static APIError = real.default.APIError;
    static RateLimitError = real.default.RateLimitError;
  }
  return { default: Fake };
});

import { resetAiSearch, rewriteQuery } from './aiSearch.js';

const answer = (queries: string[], stop = 'end_turn') => ({ stop_reason: stop, parsed_output: { queries } });

afterEach(() => {
  resetAiSearch();
  parse.mockReset();
});

describe('rewriteQuery', () => {
  it('asks the small model with only the text, low effort, structured output', async () => {
    parse.mockResolvedValueOnce(answer(['Stesen KTM Gemas']));
    expect(await rewriteQuery('ktm gemas')).toEqual(['Stesen KTM Gemas']);
    const req = parse.mock.calls[0][0];
    expect(req.model).toBe('claude-haiku-5-5');
    expect(req.output_config.effort).toBe('low');
    expect(req.output_config.format).toBeDefined();
    expect(req.messages).toEqual([{ role: 'user', content: 'ktm gemas' }]);
    expect(JSON.stringify(req)).not.toMatch(/lat|lng/);
  });

  it('remembers a rewrite (same text, any case/spacing) instead of asking again', async () => {
    parse.mockResolvedValueOnce(answer(['Jalan Ipoh']));
    await rewriteQuery('jln ipoh');
    expect(await rewriteQuery('  JLN   ipoh ')).toEqual(['Jalan Ipoh']);
    expect(parse).toHaveBeenCalledTimes(1);
  });

  it('drops repeats of the original text, blanks and extras', async () => {
    parse.mockResolvedValueOnce(answer(['ktm gemas', ' ', 'Stesen KTM Gemas', 'stesen ktm  gemas', 'Gemas', 'Extra']));
    expect(await rewriteQuery('ktm gemas')).toEqual(['Stesen KTM Gemas', 'Gemas', 'Extra']);
  });

  it('gives nothing (and search carries on) on refusal, error, or too short text', async () => {
    parse.mockResolvedValueOnce(answer(['x'], 'refusal'));
    expect(await rewriteQuery('something odd')).toEqual([]);
    parse.mockRejectedValueOnce(new Error('timeout'));
    expect(await rewriteQuery('another one')).toEqual([]);
    expect(await rewriteQuery('ab')).toEqual([]);
    expect(parse).toHaveBeenCalledTimes(2);
  });

  it('stops calling the model past the hourly cap', async () => {
    parse.mockResolvedValue(answer([]));
    const t = Date.parse('2026-11-18T10:00:00Z');
    for (let i = 0; i < 400; i++) await rewriteQuery(`query number ${i}`, t);
    expect(parse).toHaveBeenCalledTimes(400);
    expect(await rewriteQuery('one more query', t + 60_000)).toEqual([]);
    expect(parse).toHaveBeenCalledTimes(400);
    await rewriteQuery('next hour query', t + 3601_000);
    expect(parse).toHaveBeenCalledTimes(401);
  });
});
