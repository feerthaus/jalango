import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config.js';

/** Service-role client. Server-only: bypasses RLS, never expose its key. */
export const supabaseAdmin: SupabaseClient | null =
  config.supabaseUrl && config.supabaseServiceRoleKey
    ? createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null;
