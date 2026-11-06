import { Loader2, MailCheck } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/Button';
import { useOAuthProviders } from '@/hooks/useOAuthProviders';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/cn';

/** Email + password sign in / register (Supabase Auth). */
export function AuthForm({ compact = false, onDone }: { compact?: boolean; onDone?: () => void }) {
  const { available, signIn, signUp, signInWithProvider, authError } = useAuth();
  const providers = useOAuthProviders();
  const anySocial = Boolean(providers?.google || providers?.facebook);
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkEmail, setCheckEmail] = useState(false);

  if (!available) {
    return <p className="text-sm text-ink-500 dark:text-ink-400">Accounts aren’t available yet — the community database is not connected.</p>;
  }

  if (checkEmail) {
    return (
      <div className="flex items-start gap-3 text-sm">
        <MailCheck className="mt-0.5 size-5 shrink-0 text-jade-500" />
        <div>
          <p className="font-semibold">Check your email</p>
          <p className="text-ink-500 dark:text-ink-300">
            We sent a confirmation link to <strong>{email}</strong>. Open it, then sign in here.
          </p>
          <button type="button" className="mt-2 text-sm font-semibold text-jade-600 dark:text-jade-400" onClick={() => { setCheckEmail(false); setMode('signin'); }}>
            Back to sign in
          </button>
        </div>
      </div>
    );
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === 'signin') {
        await signIn(email, password);
        onDone?.();
      } else {
        const { needsConfirmation } = await signUp(email, password, name);
        if (needsConfirmation) setCheckEmail(true);
        else onDone?.();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  const input =
    'w-full rounded-xl bg-ink-100 px-3 py-2.5 text-base outline-none ring-jade-500 placeholder:text-ink-400 focus:ring-2 dark:bg-ink-800';

  const social = async (provider: 'google' | 'facebook') => {
    setError(null);
    setBusy(true);
    try {
      await signInWithProvider(provider); // navigates away on success
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed');
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-2.5" noValidate>
      {anySocial && (
        <div className={providers?.google && providers?.facebook ? 'grid grid-cols-2 gap-2' : 'grid gap-2'}>
          {providers?.google && (
        <button
          type="button"
          onClick={() => void social('google')}
          disabled={busy}
          className="flex items-center justify-center gap-2 rounded-xl bg-white px-3 py-2.5 text-sm font-semibold text-ink-900 ring-1 ring-ink-200 hover:bg-ink-50 disabled:opacity-50 dark:ring-ink-600"
        >
          <GoogleIcon /> Google
        </button>
          )}
          {providers?.facebook && (
        <button
          type="button"
          onClick={() => void social('facebook')}
          disabled={busy}
          className="flex items-center justify-center gap-2 rounded-xl bg-[#1877F2] px-3 py-2.5 text-sm font-semibold text-white hover:bg-[#166fe0] disabled:opacity-50"
        >
          <FacebookIcon /> Facebook
        </button>
          )}
        </div>
      )}
      {authError && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {authError}
        </p>
      )}
      {anySocial && (
      <div className="flex items-center gap-3 py-1 text-xs text-ink-400">
        <span className="h-px flex-1 bg-ink-200 dark:bg-ink-700" /> or with email <span className="h-px flex-1 bg-ink-200 dark:bg-ink-700" />
      </div>
      )}
      {!compact && (
        <div role="tablist" className="grid grid-cols-2 gap-1 rounded-xl bg-ink-100 p-1 dark:bg-ink-800">
          {(['signin', 'signup'] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => { setMode(m); setError(null); }}
              className={cn('rounded-lg py-2 text-sm font-semibold', mode === m ? 'bg-white shadow-sm dark:bg-ink-700' : 'text-ink-500')}
            >
              {m === 'signin' ? 'Sign in' : 'Create account'}
            </button>
          ))}
        </div>
      )}
      {mode === 'signup' && (
        <input className={input} placeholder="Name (optional)" autoComplete="name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} aria-label="Name" />
      )}
      <input className={input} type="email" required placeholder="Email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Email" />
      <input
        className={input}
        type="password"
        required
        minLength={8}
        placeholder={mode === 'signup' ? 'Password (min. 8 characters)' : 'Password'}
        autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        aria-label="Password"
      />
      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      <Button type="submit" className="w-full py-3" disabled={busy || !email || !password}>
        {busy && <Loader2 className="size-4 animate-spin" />}
        {mode === 'signin' ? 'Sign in' : 'Create account'}
      </Button>
      <p className="text-center text-[11px] text-ink-400">
        By continuing you agree to the{' '}
        <Link to="/terms" className="underline">
          Terms
        </Link>{' '}
        and{' '}
        <Link to="/privacy" className="underline">
          Privacy Policy
        </Link>
        .
      </p>
      {compact && (
        <p className="text-center text-xs text-ink-500">
          {mode === 'signin' ? 'New to JalanGo?' : 'Have an account?'}{' '}
          <button type="button" className="font-semibold text-jade-600 dark:text-jade-400" onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}>
            {mode === 'signin' ? 'Create an account' : 'Sign in'}
          </button>
        </p>
      )}
    </form>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" className="size-4" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden>
      <path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.96.93-1.96 1.88v2.26h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07z" />
    </svg>
  );
}
