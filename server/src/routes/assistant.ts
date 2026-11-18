import Anthropic from '@anthropic-ai/sdk';
import { Router } from 'express';
import { z } from 'zod';
import { config } from '../config.js';
import { HttpError } from '../lib/errors.js';
import { supabaseAdmin } from '../lib/supabaseAdmin.js';
import { hashKey } from '../middleware/rateLimit.js';
import { askAssistant } from '../services/assistant/assistant.js';
import { userFromRequest } from './account.js';

export const assistantSchema = z.object({
  /** recent turns, oldest first, ending with the new question */
  messages: z
    .array(z.object({ role: z.enum(['user', 'assistant']), text: z.string().trim().min(1).max(600) }))
    .min(1)
    .max(10)
    .refine((m) => m[m.length - 1].role === 'user', 'the last message must be the question'),
  /** the person's location (the app rounds it); optional */
  near: z.object({ lat: z.number().min(0.5).max(7.5), lng: z.number().min(99).max(120) }).optional(),
  lang: z.enum(['ms', 'en']).default('ms'),
});

/** Questions per signed-in person per day (UTC day), to keep the cost bounded. */
export function assistantDailyLimit(): number {
  const n = Number(process.env.ASSISTANT_DAILY_LIMIT);
  return Number.isFinite(n) && n > 0 ? n : 20;
}

type DayCounter = (key: string) => Promise<number>;
const memory = new Map<string, { day: number; n: number }>();
/** Shared counter in Supabase (same table as rate limits); per-instance memory if it's down. */
let counter: DayCounter = async (key) => {
  if (supabaseAdmin) {
    try {
      const { data, error } = await supabaseAdmin.rpc('hit_rate_limit', { p_key: key, p_window_seconds: 86_400 });
      if (!error && typeof data === 'number') return data;
    } catch {
      /* fall through to the per-instance count */
    }
  }
  const day = Math.floor(Date.now() / 86_400_000);
  const m = memory.get(key);
  const n = m && m.day === day ? m.n + 1 : 1;
  memory.set(key, { day, n });
  return n;
};
/** Tests only. */
export function setAssistantCounter(c: DayCounter): void {
  counter = c;
}

export const assistantRouter = Router();

assistantRouter.post('/', async (req, res) => {
  if (!config.anthropicKey) throw new HttpError(503, 'assistant_not_configured', 'The trip assistant is not switched on yet');
  const user = await userFromRequest(req);
  if (!user) throw new HttpError(401, 'unauthorized', 'Please sign in to use the trip assistant');
  const body = assistantSchema.parse(req.body);
  const limit = assistantDailyLimit();
  const used = await counter(hashKey(user.id, 'assistant'));
  if (used > limit) throw new HttpError(429, 'daily_limit', `You have used today's ${limit} questions. Try again tomorrow.`);
  const near = body.near ? { lat: Math.round(body.near.lat * 1000) / 1000, lng: Math.round(body.near.lng * 1000) / 1000 } : undefined;
  try {
    const out = await askAssistant(body.messages, { near, lang: body.lang });
    res.json({ ...out, remaining: Math.max(0, limit - used) });
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      console.warn(`[assistant] API error ${err.status}`);
      throw new HttpError(502, 'assistant_unavailable', 'The trip assistant is busy right now. Please try again in a moment.');
    }
    throw err;
  }
});
