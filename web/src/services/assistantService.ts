import { supabase } from '@/lib/supabase';
import type { Coordinates } from '@/types';
import { apiPost } from './apiClient';

/** Trip assistant (Claude): plain-language trip questions answered with JalanGo's planner and search. */

export interface ChatTurn {
  role: 'user' | 'assistant';
  text: string;
}

export interface AssistantPlace {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
}

export interface AssistantAnswer {
  reply: string;
  places: AssistantPlace[];
  /** questions left today */
  remaining: number;
}

const MAX_TURNS = 8;

export async function askAssistant(history: ChatTurn[], near: Coordinates | null, lang: 'ms' | 'en'): Promise<AssistantAnswer> {
  if (!supabase) throw new Error('Accounts are not available.');
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Please sign in again first.');
  // Only the recent turns go to the server; nothing is stored there
  const messages = history.slice(-MAX_TURNS).map((m) => ({ role: m.role, text: m.text.slice(0, 600) }));
  // ~100 m is plenty to plan from
  const at = near ? { lat: Math.round(near.lat * 1000) / 1000, lng: Math.round(near.lng * 1000) / 1000 } : undefined;
  return apiPost<AssistantAnswer>('/assistant', { messages, near: at, lang }, token);
}
