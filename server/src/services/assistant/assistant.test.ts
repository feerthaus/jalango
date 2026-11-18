import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../config.js', () => ({ config: { anthropicKey: 'test-key' }, integrations: {} }));
const runTool = vi.hoisted(() => vi.fn());
vi.mock('./tools.js', () => ({ TOOLS: [{ name: 'search_place' }], runTool }));

import type Anthropic from '@anthropic-ai/sdk';
import { askAssistant, setAssistantClient } from './assistant.js';

const create = vi.fn();
setAssistantClient({ beta: { messages: { create } } } as unknown as Anthropic);
const now = Date.parse('2026-11-18T23:00:00Z'); // 07:00 Thursday in Malaysia

afterEach(() => {
  create.mockReset();
  runTool.mockReset();
});

describe('trip assistant', () => {
  it('runs the tools Claude asks for (together), then returns its answer and the places it mentions', async () => {
    create
      .mockResolvedValueOnce({
        stop_reason: 'tool_use',
        content: [
          { type: 'text', text: 'Saya semak dulu.' },
          { type: 'tool_use', id: 't1', name: 'search_place', input: { query: 'KLIA T1' } },
          { type: 'tool_use', id: 't2', name: 'search_place', input: { query: 'Bangsar' } },
        ],
      })
      .mockResolvedValueOnce({ stop_reason: 'end_turn', content: [{ type: 'text', text: 'Naik LRT ke KL Sentral, kemudian KLIA Ekspres ke KLIA Terminal 1 (~RM56).' }] });
    runTool.mockImplementation(async (name: string, input: { query: string }, ctx: { places: Map<string, unknown> }) => {
      if (input.query === 'KLIA T1') ctx.places.set('p1', { id: 'p1', name: 'KLIA Terminal 1', address: 'Sepang', lat: 2.75, lng: 101.7 });
      if (input.query === 'Bangsar') ctx.places.set('p2', { id: 'p2', name: 'Bangsar South', address: 'KL', lat: 3.11, lng: 101.66 });
      return { results: [] };
    });
    const out = await askAssistant([{ role: 'user', text: 'Bangsar ke KLIA esok pagi, paling murah?' }], { near: { lat: 3.13, lng: 101.68 }, lang: 'ms', now });
    expect(out.reply).toContain('KLIA Ekspres');
    expect(out.places.map((p) => p.name)).toEqual(['KLIA Terminal 1']); // only what the answer talks about
    expect(runTool).toHaveBeenCalledTimes(2);

    const first = create.mock.calls[0][0];
    expect(first.model).toBe('claude-sonnet-5-5');
    expect(first.output_config).toEqual({ effort: 'low' });
    expect(first.fallbacks).toBe('default');
    expect(first.betas).toContain('server-side-fallback-2026-07-01');
    // time and rounded location go with the question, not in the (cached) system prompt
    expect(first.system).not.toMatch(/2026|3\.13/);
    expect(JSON.stringify(first.messages)).toContain('2026-11-19 07:00 (Thursday, Malaysia time)');
    expect(JSON.stringify(first.messages)).toContain('3.130, 101.680');
    // second call: assistant turn echoed back, then both results in ONE user message
    const second = create.mock.calls[1][0].messages;
    expect(second[1].role).toBe('assistant');
    expect(second[2].role).toBe('user');
    expect(second[2].content.map((b: { tool_use_id: string }) => b.tool_use_id)).toEqual(['t1', 't2']);
  });

  it('turns a tool failure into an error result instead of stopping', async () => {
    create
      .mockResolvedValueOnce({ stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 't1', name: 'drive_estimate', input: {} }] })
      .mockResolvedValueOnce({ stop_reason: 'end_turn', content: [{ type: 'text', text: 'Maaf, laluan memandu tak dapat dikira.' }] });
    runTool.mockRejectedValueOnce(new Error('Both points must be in Malaysia'));
    const out = await askAssistant([{ role: 'user', text: 'memandu ke Singapura' }], { lang: 'ms', now });
    const result = create.mock.calls[1][0].messages[2].content[0];
    expect(result).toMatchObject({ type: 'tool_result', tool_use_id: 't1', is_error: true });
    expect(out.reply).toContain('Maaf');
  });

  it('answers politely on a refusal, and stops after a few rounds', async () => {
    create.mockResolvedValueOnce({ stop_reason: 'refusal', content: [] });
    expect((await askAssistant([{ role: 'user', text: 'x' }], { lang: 'en', now })).reply).toMatch(/getting around Malaysia/);
    create.mockResolvedValue({ stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 't', name: 'search_place', input: { query: 'a' } }] });
    runTool.mockResolvedValue({ results: [] });
    const out = await askAssistant([{ role: 'user', text: 'loop' }], { lang: 'en', now });
    expect(create.mock.calls.length).toBeLessThanOrEqual(7);
    expect(out.reply).toMatch(/try again/);
  });
});
