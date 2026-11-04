import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env, features } from './config';

/**
 * Supabase browser client (anon key + RLS). `null` when not configured,
 * in which case the app runs in guest/local mode.
 * Used from Phase 3 (reports + realtime) and Phase 4 (auth, profiles).
 */
export const supabase: SupabaseClient | null = features.supabase
  ? createClient(env.supabaseUrl!, env.supabaseAnonKey!, {
      auth: { persistSession: true, autoRefreshToken: true },
    })
  : null;
