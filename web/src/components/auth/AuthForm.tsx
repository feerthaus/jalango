import { Loader2, MailCheck } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/cn';

/** Email + password sign in / register (Supabase Auth). */
export function AuthForm({ compact = false, onDone }: { compact?: boolean; onDone?: () => void }) {
  const { available, signIn, signUp } = useAuth();
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

  return (
    <form onSubmit={submit} className="space-y-2.5" noValidate>
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
