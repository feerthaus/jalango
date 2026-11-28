import Anthropic from '@anthropic-ai/sdk';
import { config } from '../../config.js';
import type { Coordinates } from '../../types.js';
import { withUsagePolicy } from '../../lib/usageGuard.js';
import { runTool, TOOLS, type FoundPlace } from './tools.js';

/**
 * Trip assistant ("Pembantu perjalanan"): plain-language trip questions,
 * answered by Claude Sonnet 5.5 using JalanGo's own tools (search, public
 * transport planner, driving with traffic, Grab estimate). The conversation is
 * not stored: the app sends the recent turns with each question.
 */
export const ASSISTANT_MODEL = 'claude-sonnet-5-5';
const MAX_ROUNDS = 6;
/** Stop starting new model calls after this, so the reply fits in the function's time limit. */
const SOFT_DEADLINE_MS = 20_000;

const SYSTEM = `You are JalanGo's trip assistant ("Pembantu perjalanan JalanGo"), inside a free Malaysian navigation app. You help people find places to eat and things to see around them, and decide how to get somewhere in Malaysia: driving, public transport (KTM, ETS, LRT, MRT, Monorail, BRT, KLIA Ekspres/Transit, Rapid buses), Grab/taxi or walking, when to leave, and what it costs.

How to work:
- Use the tools for every fact: places and coordinates (search_place), food and things to see nearby (places_around), public transport times and fares (plan_public_transport), driving time with traffic, fuel and tolls (drive_estimate), Grab estimates (taxi_estimate). Never state a time, price, line, station or address you did not get from a tool. If a tool finds nothing, say so.
- When the start is not given, use the person's current location from the context note; if it is unknown, ask where they start.
- When the person compares options or asks for the cheapest/fastest/best way, check the relevant modes (usually public transport and driving, plus Grab when useful) in parallel, then recommend one clearly with the reason (time, cost, comfort, luggage, number of people). Driving cost = fuel + tolls; parking is extra (say so; airports and city centres charge by the day).
- Times are Malaysia time. Fares are estimates; say "anggaran"/"about".
- You cannot book or buy tickets. ETS/Intercity tickets: KTMB's site or app (book ahead). City rail and KLIA Ekspres/Transit: tap Touch 'n Go or a bank card.
- You have no reviews, ratings or opening hours. For food or things to see around somewhere ("tempat makan best dekat sini", "tempat menarik"), use places_around and list a few with distance, saying what JalanGo knows: "disyorkan N orang dalam JalanGo" for community picks, "disahkan N orang" for confirmed places, nothing for the rest. Say briefly that JalanGo has no reviews or ratings. Never call a place good, sedap or popular yourself, and never make up a rating, price or opening hours. If they want a type (nasi kandar, seafood, halal, family), say you can only match it by name, and suggest they ask locals or check the place.
- Only travel and getting around in Malaysia. Politely decline anything else in one sentence.

How to answer:
- Reply in the person's language (Bahasa Melayu or English; follow their mix).
- Short and scannable for a phone: at most about 120 words. Plain text with line breaks and simple "- " bullets. No tables, no headings, no markdown links.
- Lead with the recommendation, then the key times and costs, then one practical tip if useful.
- If the person seems to be driving right now, answer in one or two short sentences.`;

export interface ChatTurn {
  role: 'user' | 'assistant';
  text: string;
}

export interface AssistantReply {
  reply: string;
  places: FoundPlace[];
}

let client: Anthropic | null = null;
/** Tests swap the client. */
export function setAssistantClient(c: Anthropic | null): void {
  client = c;
}

function contextNote(near: Coordinates | undefined, now: number, lang: 'ms' | 'en'): string {
  const t = new Date(now + 8 * 3600_000);
  const day = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][t.getUTCDay()];
  const at = `${t.toISOString().slice(0, 16).replace('T', ' ')} (${day}, Malaysia time)`;
  const where = near ? `${near.lat.toFixed(3)}, ${near.lng.toFixed(3)} (approximate)` : 'unknown';
  return `[Context from the app: now ${at}; person's location ${where}; app language ${lang === 'ms' ? 'Bahasa Melayu' : 'English'}.]`;
}

export async function askAssistant(turns: ChatTurn[], opts: { near?: Coordinates; lang: 'ms' | 'en'; now?: number }): Promise<AssistantReply> {
  if (!config.anthropicKey) throw new Error('assistant not configured');
  const now = opts.now ?? Date.now();
  const started = Date.now();
  client ??= new Anthropic({ apiKey: config.anthropicKey, timeout: 18_000, maxRetries: 1 });

  const messages: Anthropic.Beta.BetaMessageParam[] = turns.map((t, i) =>
    i === turns.length - 1 && t.role === 'user'
      ? { role: 'user', content: [{ type: 'text', text: contextNote(opts.near, now, opts.lang) }, { type: 'text', text: t.text }] }
      : { role: t.role, content: t.text },
  );
  const places = new Map<string, FoundPlace>();
  let lastText = '';

  for (let round = 0; round < MAX_ROUNDS; round++) {
    if (round > 0 && Date.now() - started > SOFT_DEADLINE_MS) break;
    const res = await client.beta.messages.create({
      model: ASSISTANT_MODEL,
      max_tokens: 4096,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low' },
      cache_control: { type: 'ephemeral' },
      system: SYSTEM,
      tools: TOOLS,
      messages,
    });
    const text = res.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim();
    if (text) lastText = text;
    if (res.stop_reason === 'refusal') {
      return { reply: opts.lang === 'ms' ? 'Maaf, saya tak dapat bantu dengan itu. Saya hanya boleh bantu tentang perjalanan di Malaysia.' : 'Sorry, I can’t help with that. I can only help with getting around Malaysia.', places: [] };
    }
    if (res.stop_reason !== 'tool_use') break;

    messages.push({ role: 'assistant', content: res.content });
    const calls = res.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === 'tool_use');
    // Tool calls in one turn run together; every result goes back in one message
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

  const reply =
    lastText ||
    (opts.lang === 'ms' ? 'Maaf, saya tak sempat siapkan jawapan. Cuba tanya sekali lagi dengan lebih ringkas.' : 'Sorry, I couldn’t finish an answer in time. Please try again with a shorter question.');
  // Places the reply talks about, for "Arah" buttons in the app
  const mentioned = [...places.values()].filter((p) => reply.toLowerCase().includes(p.name.toLowerCase().split(',')[0].slice(0, 24)));
  return { reply, places: (mentioned.length ? mentioned : []).slice(0, 4) };
}
