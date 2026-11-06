import type { Session, User } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';

interface AuthValue {
  /** false when Supabase isn't configured: the app runs guest-only */
  available: boolean;
  loading: boolean;
  user: User | null;
  session: Session | null;
  signIn: (email: string, password: string) => Promise<void>;
  /** Returns true when the user must confirm their email before signing in */
  signUp: (email: string, password: string, name: string) => Promise<{ needsConfirmation: boolean }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

function friendly(message: string): string {
  if (/invalid login credentials/i.test(message)) return 'Wrong email or password.';
  if (/email not confirmed/i.test(message)) return 'Please confirm your email first — check your inbox.';
  if (/already registered/i.test(message)) return 'An account with this email already exists. Try signing in.';
  if (/password should be at least/i.test(message)) return 'Password must be at least 8 characters.';
  if (/rate limit|too many/i.test(message)) return 'Too many attempts. Please wait a moment and try again.';
  if (/fetch|network/i.test(message)) return 'Can’t reach the server. Check your connection.';
  return message;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(Boolean(supabase));

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    supabase.auth
      .getSession()
      .then(({ data }) => active && setSession(data.session))
      .finally(() => active && setLoading(false));
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) throw new Error('Accounts are not available yet.');
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw new Error(friendly(error.message));
  }, []);

  const signUp = useCallback(async (email: string, password: string, name: string) => {
    if (!supabase) throw new Error('Accounts are not available yet.');
    if (password.length < 8) throw new Error('Password must be at least 8 characters.');
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { name: name.trim() || undefined }, emailRedirectTo: window.location.origin },
    });
    if (error) throw new Error(friendly(error.message));
    return { needsConfirmation: !data.session };
  }, []);

  const signOut = useCallback(async () => {
    await supabase?.auth.signOut();
  }, []);

  const value = useMemo<AuthValue>(
    () => ({ available: Boolean(supabase), loading, user: session?.user ?? null, session, signIn, signUp, signOut }),
    [loading, session, signIn, signUp, signOut],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
