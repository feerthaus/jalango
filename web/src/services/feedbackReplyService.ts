import { supabase } from '@/lib/supabase';

const KEY = 'jalango:feedback-code';

/** This device's reply code, if it ever sent feedback (lets a guest read the reply here). */
export function feedbackCode(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

/** The device's reply code, made on first use: 24 random bytes, base64url. Only its hash leaves the server's hands. */
export function ensureFeedbackCode(): string | undefined {
  const have = feedbackCode();
  if (have) return have;
  try {
    const bytes = crypto.getRandomValues(new Uint8Array(24));
    const code = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    localStorage.setItem(KEY, code);
    return code;
  } catch {
    return undefined; // no storage: a reply can still reach a signed-in account
  }
}

export interface FeedbackReply {
  id: string;
  category: string;
  message: string;
  created_at: string;
  reply: string;
  replied_at: string;
  reply_seen_at: string | null;
}

/** Answered feedback for this account or device, newest reply first. */
export async function fetchMyReplies(): Promise<FeedbackReply[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.rpc('my_feedback_replies', { p_token: feedbackCode() });
  if (error) throw new Error(error.message);
  return (data ?? []) as FeedbackReply[];
}

export async function markReplySeen(id: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.rpc('mark_feedback_reply_seen', { p_id: id, p_token: feedbackCode() });
  if (error) throw new Error(error.message);
}
