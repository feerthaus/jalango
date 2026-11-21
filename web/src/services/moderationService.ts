import { adminChanged } from './adminCounts';
import { supabase } from '@/lib/supabase';
import { toReportError } from './reportsService';

export type FlagContentType = 'report' | 'shortcut' | 'place';
export type FlagReason = 'spam' | 'fake' | 'offensive' | 'personal_info' | 'dangerous' | 'other';

export const FLAG_REASONS: { id: FlagReason; label: string; labelMs: string }[] = [
  { id: 'fake', label: 'False or misleading', labelMs: 'Palsu / mengelirukan' },
  { id: 'spam', label: 'Spam or advertising', labelMs: 'Spam / iklan' },
  { id: 'offensive', label: 'Offensive or hateful', labelMs: 'Kesat / berbaur kebencian' },
  { id: 'personal_info', label: 'Personal information', labelMs: 'Maklumat peribadi orang' },
  { id: 'dangerous', label: 'Dangerous or illegal', labelMs: 'Berbahaya / menyalahi undang-undang' },
  { id: 'other', label: 'Something else', labelMs: 'Lain-lain' },
];

function client() {
  if (!supabase) throw new Error('Community features are not connected yet.');
  return supabase;
}

export async function flagContent(type: FlagContentType, id: string, reason: FlagReason, note: string, userId: string): Promise<void> {
  const { error } = await client()
    .from('content_flags')
    .insert({ reporter_id: userId, content_type: type, content_id: id, reason, note: note.trim().slice(0, 280) || null });
  if (error) {
    if (error.code === '23505') throw new Error('You already reported this. Thanks — we’ll review it.');
    throw toReportError(error);
  }
}

export async function isAdmin(): Promise<boolean> {
  if (!supabase) return false;
  const { data, error } = await supabase.rpc('is_admin');
  return !error && data === true;
}

export interface FlagQueueItem {
  content_type: FlagContentType;
  content_id: string;
  flags: number;
  reasons: FlagReason[];
  notes: string[];
  last_flagged: string;
  owner_id: string | null;
  owner_banned: boolean;
  title: string | null;
  detail: string | null;
  content_status: string | null;
}

export async function fetchFlagQueue(): Promise<FlagQueueItem[]> {
  const { data, error } = await client().rpc('admin_flag_queue');
  if (error) throw new Error(error.message);
  return (data ?? []) as FlagQueueItem[];
}

export async function moderate(type: FlagContentType, id: string, action: 'remove' | 'restore' | 'dismiss'): Promise<void> {
  const { error } = await client().rpc('admin_moderate', { p_type: type, p_id: id, p_action: action });
  if (error) throw new Error(error.message);
  adminChanged();
}

export async function setBan(userId: string, banned: boolean): Promise<void> {
  const { error } = await client().rpc('admin_set_ban', { p_user: userId, p_banned: banned });
  if (error) throw new Error(error.message);
}

export interface FeedbackItem {
  id: string;
  category: string;
  message: string;
  contact: string | null;
  page: string | null;
  status: 'new' | 'read' | 'done';
  created_at: string;
  reply: string | null;
  replied_at: string | null;
  reply_seen_at: string | null;
  /** the sender can see a reply in the app (signed in, or a guest's device code) */
  can_reply: boolean;
}

export async function fetchFeedback(): Promise<FeedbackItem[]> {
  const { data, error } = await client()
    .from('feedback')
    .select('id,category,message,contact,page,status,created_at,reply,replied_at,reply_seen_at,user_id,device_token_hash')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  return (data ?? []).map(({ user_id, device_token_hash, ...f }) => ({ ...f, can_reply: Boolean(user_id || device_token_hash) })) as FeedbackItem[];
}

/** Answer a message: the sender sees it in JalanGo (map screen card). */
export async function replyToFeedback(id: string, reply: string): Promise<void> {
  const { error } = await client().rpc('admin_reply_feedback', { p_id: id, p_reply: reply });
  if (error) throw new Error(error.message);
  adminChanged();
}

export async function setFeedbackStatus(id: string, status: FeedbackItem['status']): Promise<void> {
  const { error } = await client().from('feedback').update({ status }).eq('id', id);
  if (error) throw new Error(error.message);
  adminChanged();
}
