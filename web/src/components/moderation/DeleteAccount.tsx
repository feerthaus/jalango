import { Loader2, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { deleteMyAccount } from '@/services/accountService';

const CONFIRM_WORD = 'PADAM';

/** Permanently delete the account and everything linked to it (PDPA). */
export function DeleteAccount() {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      await deleteMyAccount();
      window.location.assign('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete the account');
      setBusy(false);
    }
  };

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="flex items-center gap-1.5 text-sm font-semibold text-red-600 hover:underline dark:text-red-400">
        <Trash2 className="size-4" /> Delete account
      </button>
      {open && (
        <Sheet title="Delete your account?" onClose={() => !busy && setOpen(false)}>
          <div className="space-y-3 text-sm">
            <p>This permanently deletes your JalanGo account and everything linked to it:</p>
            <ul className="list-disc space-y-1 pl-5 text-ink-600 dark:text-ink-300">
              <li>your profile and sign-in</li>
              <li>road reports, votes, shortcuts and places you shared</li>
              <li>trip history and ratings</li>
              <li>data stored on this device (favourites, history, settings)</li>
            </ul>
            <p className="font-semibold text-red-600 dark:text-red-400">This can’t be undone.</p>
            <label className="block">
              <span className="text-ink-500">
                Type <strong>{CONFIRM_WORD}</strong> to confirm
              </span>
              <input
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                autoCapitalize="characters"
                aria-label={`Type ${CONFIRM_WORD} to confirm`}
                className="mt-1 w-full rounded-xl bg-ink-100 px-3 py-2.5 text-base outline-none ring-red-500 focus:ring-2 dark:bg-ink-800"
              />
            </label>
            {error && <p role="alert" className="text-red-600">{error}</p>}
            <Button variant="danger" className="w-full py-3" onClick={run} disabled={busy || typed.trim().toUpperCase() !== CONFIRM_WORD}>
              {busy && <Loader2 className="size-4 animate-spin" />} Delete my account
            </Button>
          </div>
        </Sheet>
      )}
    </>
  );
}
