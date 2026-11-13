import { useEffect, useState } from 'react';
import { useRouting } from '@/contexts/RoutingContext';
import { useInstallPrompt } from '@/hooks/useInstallPrompt';
import { InstallSheet, installSnoozed } from './InstallSheet';

const AFTER_MS = 30_000;

/**
 * Offers "Pasang JalanGo" once the person has used the app a little: after
 * ~30 s on the map or right after a trip ends. Never while driving, never when
 * installed, and not again for 3 days ("Nanti dulu") or ever ("Jangan tanya lagi").
 */
export function InstallNudge() {
  const { env } = useInstallPrompt();
  const { status } = useRouting();
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState(false);
  const driving = status === 'navigating';
  const eligible = env !== 'installed' && env !== 'desktop' && !shown && !installSnoozed();

  useEffect(() => {
    if (!eligible || driving) return;
    const id = setTimeout(() => setOpen(true), status === 'arrived' ? 4000 : AFTER_MS);
    return () => clearTimeout(id);
  }, [eligible, driving, status]);

  // Never interrupt driving: close if navigation starts
  useEffect(() => {
    if (driving && open) setOpen(false);
  }, [driving, open]);

  if (!open) return null;
  return (
    <InstallSheet
      auto
      onClose={() => {
        setOpen(false);
        setShown(true);
      }}
    />
  );
}
