import { afterEach, describe, expect, it } from 'vitest';
import { erlFeed } from '../transit/erl.js';
import { setTransitNetwork } from '../transit/feeds.js';
import { buildNetwork } from '../transit/raptor.js';
import { runTool, TOOLS } from './tools.js';

const ctx = () => ({ now: Date.parse('2026-11-18T08:00:00+08:00'), places: new Map() });
afterEach(() => setTransitNetwork(null));

describe('assistant tools', () => {
  it('are strict, with every property required', () => {
    for (const t of TOOLS) {
      const s = t.input_schema as { properties: object; required: string[]; additionalProperties: boolean };
      expect(t.strict).toBe(true);
      expect(s.additionalProperties).toBe(false);
      expect(s.required.sort()).toEqual(Object.keys(s.properties).sort());
    }
  });

  it('plan_public_transport gives a compact, readable summary', async () => {
    setTransitNetwork(buildNetwork([erlFeed()]));
    const out = (await runTool('plan_public_transport', { from_lat: 3.1342, from_lng: 101.6862, to_lat: 2.8257, to_lng: 101.7134, depart_at: null }, ctx())) as { options: { steps: string[]; fare_rm: unknown; leave_home: string }[] };
    expect(out.options[0].steps[0]).toBe('KLIA Transit 08:15 KL Sentral → 08:43 Salak Tinggi (3 stops)');
    expect(out.options[0].fare_rm).toBe(18.3);
    expect(out.options[0].leave_home).toBe('08:13');
  });

  it('honours a later departure time', async () => {
    setTransitNetwork(buildNetwork([erlFeed()]));
    const out = (await runTool('plan_public_transport', { from_lat: 3.1342, from_lng: 101.6862, to_lat: 2.8257, to_lng: 101.7134, depart_at: '2026-11-18T21:00:00+08:00' }, ctx())) as { options: { steps: string[] }[] };
    expect(out.options[0].steps[0]).toMatch(/^KLIA Transit 21:/);
  });

  it('rejects points outside Malaysia and gives a Grab estimate otherwise', async () => {
    await expect(runTool('taxi_estimate', { from_lat: 1.35, from_lng: 103.8, to_lat: 51.5, to_lng: -0.1 }, ctx())).rejects.toThrow(/Malaysia/);
    const taxi = (await runTool('taxi_estimate', { from_lat: 3.13, from_lng: 101.68, to_lat: 3.16, to_lng: 101.71 }, ctx())) as { fare_rm: string };
    expect(taxi.fare_rm).toMatch(/^\d+-\d+$/);
  });
});
