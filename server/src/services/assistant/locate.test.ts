import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../config.js', () => ({ config: { anthropicKey: 'test-key' }, integrations: {} }));
const runTool = vi.hoisted(() => vi.fn());
vi.mock('./tools.js', () => ({ TOOLS: [{ name: 'search_place', strict: true, input_schema: {} }], runTool }));

import type Anthropic from '@anthropic-ai/sdk';
import { locateAddress, setLocateClient } from './locate.js';

const create = vi.fn();
setLocateClient({ beta: { messages: { create } } } as unknown as Anthropic);
afterEach(() => {
  create.mockReset();
  runTool.mockReset();
});

const nadi = { id: 'mb-nadi', name: 'NADI Presint 9 Fasa 10', address: 'Jalan P9c, Putrajaya', lat: 2.9381, lng: 101.6765 };

describe('AI address finder', () => {
  it('searches the web without Google, finds the landmark on our map, and pins only our result', async () => {
    create
      .mockResolvedValueOnce({
        stop_reason: 'tool_use',
        content: [
          { type: 'web_search_tool_result', tool_use_id: 'w1', content: [{ type: 'web_search_result', url: 'https://presint9.example/fasa10', title: 'Presint 9 Fasa 10' }] },
          { type: 'tool_use', id: 't1', name: 'search_place', input: { query: 'NADI Presint 9 Fasa 10' } },
        ],
      })
      .mockResolvedValueOnce({
        stop_reason: 'tool_use',
        content: [{ type: 'tool_use', id: 't2', name: 'report_location', input: { place_id: 'mb-nadi', precision: 'nearby', area: 'Presint 9, Putrajaya', landmark_query: 'NADI Presint 9 Fasa 10 Putrajaya', note: 'Jalan P9C/1 di Presint 9, bersebelahan NADI Presint 9 Fasa 10.' } }],
      });
    runTool.mockImplementation(async (_n: string, _i: unknown, ctx: { places: Map<string, unknown> }) => {
      ctx.places.set('mb-nadi', nadi);
      return { results: [nadi] };
    });
    const r = await locateAddress('Jalan P9C/1', { lang: 'ms', near: { lat: 2.93, lng: 101.69 } });
    expect(r).toMatchObject({ precision: 'nearby', area: 'Presint 9, Putrajaya', landmarkQuery: 'NADI Presint 9 Fasa 10 Putrajaya' });
    expect(r.place).toEqual(nadi);
    expect(r.sources).toEqual([{ url: 'https://presint9.example/fasa10', title: 'Presint 9 Fasa 10' }]);
    const tools = create.mock.calls[0][0].tools;
    expect(tools[0]).toMatchObject({ type: 'web_search_20260209', max_uses: 3 });
    expect(tools[0].blocked_domains).toContain('google.com');
    expect(create.mock.calls[0][0].model).toBe('claude-sonnet-5-5');
  });

  it('never pins a place the model made up', async () => {
    create.mockResolvedValueOnce({
      stop_reason: 'tool_use',
      content: [{ type: 'tool_use', id: 't', name: 'report_location', input: { place_id: 'invented', precision: 'exact', area: 'Putrajaya', landmark_query: 'x', note: 'n' } }],
    });
    const r = await locateAddress('Jalan Rekaan 9', { lang: 'en' });
    expect(r.place).toBeNull();
    expect(r.precision).toBe('not_found');
    expect(r.landmarkQuery).toBeNull();
  });

  it('carries on after a paused web search turn, and gives up politely', async () => {
    create.mockResolvedValueOnce({ stop_reason: 'pause_turn', content: [{ type: 'server_tool_use', id: 's', name: 'web_search', input: {} }] }).mockResolvedValueOnce({ stop_reason: 'end_turn', content: [{ type: 'text', text: '...' }] });
    const r = await locateAddress('Jalan Hilang 1', { lang: 'ms' });
    expect(create).toHaveBeenCalledTimes(2);
    expect(create.mock.calls[1][0].messages.at(-1).role).toBe('assistant');
    expect(r.precision).toBe('not_found');
    expect(r.note).toMatch(/Tak dapat/);
  });
});
