import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import { config } from '../config.js';

/**
 * "Carian pintar": when a search finds nothing, a small, cheap model rewrites
 * the text the way a geocoder understands it (typos, short forms such as
 * "sek 7 sa", "kg", "jln", "ktm gemas", Malay filler words). It only rewrites
 * the text; places always come from our normal search, never from the model.
 *
 * Only the search text is sent (no location, no user). Rewrites are cached,
 * and there is an hourly cap so a burst can't run up the bill.
 */
const MODEL = 'claude-haiku-5-5';
const CACHE_MS = 24 * 3600_000;
const MAX_CACHE = 2000;
const MAX_CALLS_PER_HOUR = 400;
const TIMEOUT_MS = 4000;

const SYSTEM = `You fix place searches typed into a Malaysian map app (Malay, English, Manglish, Chinese or Tamil place names).
The search engine found nothing for the user's text. Rewrite it into up to 3 search texts a geocoder (Mapbox / OpenStreetMap) would understand, best first.
- Fix spelling and spacing; expand short forms: jln→Jalan, tmn→Taman, kg→Kampung, sg→Sungai, bdr→Bandar, bt→Batu, sek/seksyen→Seksyen, pj→Petaling Jaya, sa→Shah Alam, kl→Kuala Lumpur, jb→Johor Bahru, hosp→Hospital, ktm→Stesen KTM, lrt/mrt→Stesen LRT/MRT, r&r/rnr→R&R, umno, pkns etc. stay as they are.
- Drop filler words such as dekat, kat, area, yang, nak pergi, tempat.
- Keep the place the user meant: never invent a business, address or brand that the text does not name or clearly imply.
- If the text is not a place search (a question, rude, or meaningless), return no queries.`;

const Rewrite = z.object({ queries: z.array(z.string()).max(3) });

let client: Anthropic | null = null;
const cache = new Map<string, { at: number; queries: string[] }>();
const inflight = new Map<string, Promise<string[]>>();
let windowStart = 0;
let callsThisHour = 0;

export const aiSearchEnabled = () => Boolean(config.anthropicKey);

const norm = (q: string) => q.trim().toLowerCase().replace(/\s+/g, ' ');

function underCap(now: number): boolean {
  if (now - windowStart > 3600_000) {
    windowStart = now;
    callsThisHour = 0;
  }
  if (callsThisHour >= MAX_CALLS_PER_HOUR) return false;
  callsThisHour += 1;
  return true;
}

/** Other ways to search for `q` (empty when off, over the cap, or nothing sensible). */
export async function rewriteQuery(q: string, now = Date.now()): Promise<string[]> {
  if (!config.anthropicKey) return [];
  const key = norm(q);
  if (key.length < 3 || key.length > 120) return [];
  const hit = cache.get(key);
  if (hit && now - hit.at < CACHE_MS) return hit.queries;
  const running = inflight.get(key);
  if (running) return running;
  if (!underCap(now)) return [];

  const job = (async () => {
    try {
      client ??= new Anthropic({ apiKey: config.anthropicKey!, timeout: TIMEOUT_MS, maxRetries: 0 });
      const res = await client.messages.parse({
        model: MODEL,
        max_tokens: 1024,
        output_config: { effort: 'low', format: zodOutputFormat(Rewrite) },
        system: SYSTEM,
        messages: [{ role: 'user', content: q.trim() }],
      });
      if (res.stop_reason === 'refusal' || !res.parsed_output) return [];
      const seen = new Set([key]);
      const queries = res.parsed_output.queries
        .map((s) => s.trim().replace(/\s+/g, ' '))
        .filter((s) => s.length >= 2 && s.length <= 120 && !seen.has(norm(s)) && (seen.add(norm(s)), true))
        .slice(0, 3);
      if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value!);
      cache.set(key, { at: now, queries });
      return queries;
    } catch (err) {
      // Search must work without AI: log and carry on with no rewrite
      if (err instanceof Anthropic.RateLimitError) console.warn('[ai-search] rate limited');
      else if (err instanceof Anthropic.APIError) console.warn(`[ai-search] API error ${err.status}`);
      else console.warn('[ai-search] failed:', err instanceof Error ? err.message : err);
      return [];
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, job);
  return job;
}

/** Tests only. */
export function resetAiSearch(): void {
  cache.clear();
  inflight.clear();
  callsThisHour = 0;
  windowStart = 0;
  client = null;
}
