import Anthropic from '@anthropic-ai/sdk';
import { config } from '../../config.js';
import type { Coordinates } from '../../types.js';
import { withUsagePolicy } from '../../lib/usageGuard.js';
import { runTool, TOOLS, type FoundPlace } from './tools.js';

/**
 * AI address finder: for an address our map search can't find ("Jalan P9C/1"),
 * Claude looks it up on the web (never Google Maps) to learn the area and a
 * landmark next to it, then finds that landmark with JalanGo's own search.
 * The pin always comes from our search, never from a web page or the model.
 */
const MODEL = 'claude-sonnet-5-5';
const MAX_ROUNDS = 6;
const SOFT_DEADLINE_MS = 22_000;

/** Google's map content may not feed a non-Google map: keep its pages out of the web search. */
const BLOCKED = ['google.com', 'google.com.my', 'goo.gl', 'g.page', 'g.co'];

const SYSTEM = `You help a Malaysian navigation app find an address its map search could not find.
1. Use web_search (at most a couple of searches) to learn where the address is: town/area, postcode, and the nearest well-known landmark (school, mosque, clinic, community centre, apartment block, shop row) on or next to that road.
2. Use search_place to find that landmark (or the road itself, or the area) on our map. Try the most specific first. Only places returned by search_place can be pinned.
3. Call report_location once with your answer. Pick the search_place result that is ON the address if any; otherwise the closest landmark next to it; otherwise the area.
Never invent coordinates or places. If the web gives nothing reliable, report precision "not_found".
Write "note" in the app language given, one short sentence, e.g. "Jalan P9C/1 di Presint 9, Putrajaya, bersebelahan NADI Presint 9 Fasa 10." Keep "landmark_query" to the words to search for the chosen place.`;

const REPORT: Anthropic.Beta.BetaTool = {
  name: 'report_location',
  description: 'Give the final answer: which search_place result to pin, and how close it is to the asked address.',
  strict: true,
  input_schema: {
    type: 'object',
    properties: {
      place_id: { type: ['string', 'null'], description: 'id of a search_place result to pin; null if none fits' },
      precision: { type: 'string', enum: ['exact', 'nearby', 'area', 'not_found'], description: 'exact: the place is the address; nearby: a landmark next to it; area: only the town/area' },
      area: { type: 'string', description: 'Town/area and state, e.g. "Presint 9, Putrajaya"' },
      landmark_query: { type: ['string', 'null'], description: 'search text that finds the pinned place on the map' },
      note: { type: 'string', description: 'one short sentence for the person, in the app language' },
    },
    required: ['place_id', 'precision', 'area', 'landmark_query', 'note'],
    additionalProperties: false,
  },
};

export type Precision = 'exact' | 'nearby' | 'area' | 'not_found';

export interface LocateResult {
  precision: Precision;
  place: FoundPlace | null;
  area: string;
  note: string;
  /** search text that finds the pinned place again (for a text-only saved redirect) */
  landmarkQuery: string | null;
  sources: { title: string; url: string }[];
}

let client: Anthropic | null = null;
export function setLocateClient(c: Anthropic | null): void {
  client = c;
}

export async function locateAddress(query: string, opts: { near?: Coordinates; lang: 'ms' | 'en'; now?: number }): Promise<LocateResult> {
  if (!config.anthropicKey) throw new Error('assistant not configured');
  const now = opts.now ?? Date.now();
  const started = Date.now();
  client ??= new Anthropic({ apiKey: config.anthropicKey, timeout: 20_000, maxRetries: 1 });
  const searchPlace = TOOLS.find((t) => t.name === 'search_place')!;
  const tools: Anthropic.Beta.BetaToolUnion[] = [
    { type: 'web_search_20260209', name: 'web_search', max_uses: 3, blocked_domains: BLOCKED, user_location: { type: 'approximate', country: 'MY', timezone: 'Asia/Kuala_Lumpur' } },
    searchPlace,
    REPORT,
  ];
  const where = opts.near ? `${opts.near.lat.toFixed(2)}, ${opts.near.lng.toFixed(2)}` : 'unknown';
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    { role: 'user', content: `Address to find: "${query.slice(0, 120)}"\nPerson's approximate location: ${where}\nApp language: ${opts.lang === 'ms' ? 'Bahasa Melayu' : 'English'}` },
  ];
  const places = new Map<string, FoundPlace>();
  const sources = new Map<string, string>();
  const empty = (note: string): LocateResult => ({ precision: 'not_found', place: null, area: '', note, landmarkQuery: null, sources: [...sources].slice(0, 3).map(([url, title]) => ({ url, title })) });

  for (let round = 0; round < MAX_ROUNDS; round++) {
    if (round > 0 && Date.now() - started > SOFT_DEADLINE_MS) break;
    const res = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 4096,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low' },
      system: SYSTEM,
      tools,
      messages,
    });
    // Web pages it read, for "Sumber" links
    for (const b of res.content) {
      if (b.type === 'web_search_tool_result' && Array.isArray(b.content)) {
        for (const r of b.content) if (r.type === 'web_search_result' && sources.size < 6) sources.set(r.url, r.title);
      }
    }
    if (res.stop_reason === 'refusal') return empty(opts.lang === 'ms' ? 'Maaf, alamat ini tak dapat dicari.' : 'Sorry, this address can’t be looked up.');
    if (res.stop_reason === 'pause_turn') {
      // the server-side search loop paused: resend as is to let it carry on
      messages.push({ role: 'assistant', content: res.content });
      continue;
    }
    const calls = res.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === 'tool_use');
    const report = calls.find((c) => c.name === 'report_location');
    if (report) {
      const r = report.input as { place_id: string | null; precision: Precision; area: string; landmark_query: string | null; note: string };
      const place = r.place_id ? places.get(r.place_id) ?? null : null;
      const precision: Precision = place ? r.precision : r.precision === 'area' ? 'area' : 'not_found';
      return {
        precision,
        place,
        area: String(r.area ?? '').slice(0, 120),
        note: String(r.note ?? '').slice(0, 300),
        landmarkQuery: place && r.landmark_query ? String(r.landmark_query).slice(0, 200) : null,
        sources: [...sources].slice(0, 3).map(([url, title]) => ({ url, title })),
      };
    }
    if (res.stop_reason !== 'tool_use' || !calls.length) break;
    messages.push({ role: 'assistant', content: res.content });
    const results = await Promise.all(
      calls.map(async (c): Promise<Anthropic.Beta.BetaToolResultBlockParam> => {
        try {
          const out = await withUsagePolicy('optional', () => runTool(c.name, c.input as Record<string, unknown>, { near: opts.near, now, places }));
          return { type: 'tool_result', tool_use_id: c.id, content: JSON.stringify(out) };
        } catch (err) {
          return { type: 'tool_result', tool_use_id: c.id, is_error: true, content: err instanceof Error ? err.message : 'tool failed' };
        }
      }),
    );
    messages.push({ role: 'user', content: results });
  }
  return empty(opts.lang === 'ms' ? 'Tak dapat pastikan lokasi alamat ini.' : 'Couldn’t pin down this address.');
}
