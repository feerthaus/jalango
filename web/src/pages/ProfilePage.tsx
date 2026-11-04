import { CheckCircle2, CircleDashed, Laptop, Moon, RefreshCw, Sun, Trash2, UserRound, XCircle } from 'lucide-react';
import type { ReactNode } from 'react';
import { Logo } from '@/components/layout/BottomNav';
import { Button } from '@/components/ui/Button';
import { PagePanel } from '@/components/ui/PagePanel';
import { useLocation } from '@/contexts/LocationContext';
import { useSavedPlaces } from '@/contexts/SavedPlacesContext';
import { useServiceStatus } from '@/contexts/ServiceStatusContext';
import { useTheme, type ThemePreference } from '@/contexts/ThemeContext';
import { features } from '@/lib/config';
import { cn } from '@/lib/cn';

const THEMES: { id: ThemePreference; label: string; icon: typeof Sun }[] = [
  { id: 'system', label: 'Auto', icon: Laptop },
  { id: 'light', label: 'Light', icon: Sun },
  { id: 'dark', label: 'Dark', icon: Moon },
];

const GPS_LABEL: Record<string, string> = {
  idle: 'Not requested',
  prompt: 'Waiting for permission',
  locating: 'Locating…',
  active: 'Active',
  denied: 'Blocked by browser',
  unavailable: 'Unavailable',
  timeout: 'Timed out',
  unsupported: 'Not supported',
  insecure: 'Requires HTTPS',
};

export function ProfilePage() {
  const { preference, setPreference } = useTheme();
  const { server, searchMode, tilesMode, refresh } = useServiceStatus();
  const { status: gpsStatus, fix } = useLocation();
  const { favourites, recents, clearRecents } = useSavedPlaces();

  return (
    <PagePanel title="Profile">
      <div className="flex items-center gap-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-ink-200 dark:bg-ink-900 dark:ring-ink-800">
        <span className="grid size-14 place-items-center rounded-full bg-ink-100 text-ink-400 dark:bg-ink-800">
          <UserRound className="size-7" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Guest</p>
          <p className="text-sm text-ink-500 dark:text-ink-400">
            {favourites.length} favourite{favourites.length === 1 ? '' : 's'} · {recents.length} recent
          </p>
          <p className="mt-1 text-xs text-ink-400">Account sign-in (sync favourites & report history) is coming in a later release.</p>
        </div>
      </div>

      <Heading>Map appearance</Heading>
      <div role="radiogroup" aria-label="Theme" className="grid grid-cols-3 gap-1 rounded-2xl bg-ink-100 p-1 dark:bg-ink-900">
        {THEMES.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={preference === id}
            onClick={() => setPreference(id)}
            className={cn(
              'flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition',
              preference === id ? 'bg-white shadow-sm dark:bg-ink-700' : 'text-ink-500 hover:text-ink-800 dark:hover:text-ink-100',
            )}
          >
            <Icon className="size-4" /> {label}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between px-1 pb-2 pt-6">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-400">Data sources</h2>
        <button type="button" onClick={refresh} className="flex items-center gap-1 text-xs font-medium text-ink-500 hover:text-jade-600">
          <RefreshCw className="size-3.5" /> Re-check
        </button>
      </div>
      <ul className="divide-y divide-ink-100 rounded-2xl bg-white shadow-sm ring-1 ring-ink-200 dark:divide-ink-800 dark:bg-ink-900 dark:ring-ink-800">
        <StatusRow label="Map tiles" ok={tilesMode === 'live'} value={tilesMode === 'live' ? 'Mapbox (with live traffic)' : 'Demo: OpenStreetMap / CARTO'} />
        <StatusRow
          label="Place search"
          ok={searchMode === 'checking' ? null : searchMode === 'live'}
          value={searchMode === 'checking' ? 'Checking…' : searchMode === 'live' ? 'Mapbox (live)' : 'Demo: offline sample places'}
        />
        <StatusRow label="JalanGo server" ok={server ? server.reachable : null} value={server ? (server.reachable ? 'Reachable' : 'Unreachable') : 'Checking…'} />
        <StatusRow label="Community database" ok={features.supabase} value={features.supabase ? 'Supabase configured' : 'Not configured'} />
        <StatusRow
          label="GPS"
          ok={gpsStatus === 'active' ? true : gpsStatus === 'locating' || gpsStatus === 'prompt' || gpsStatus === 'idle' ? null : false}
          value={`${GPS_LABEL[gpsStatus]}${fix ? ` · ±${Math.round(fix.accuracy)} m` : ''}`}
        />
      </ul>

      <Heading>Privacy</Heading>
      <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-ink-200 dark:bg-ink-900 dark:ring-ink-800">
        <p className="text-sm text-ink-600 dark:text-ink-300">
          Favourites and recent destinations are stored only in this browser. Your GPS position is used on-device and sent to the
          search service only as a rounded proximity hint.
        </p>
        <Button variant="danger" className="mt-3" onClick={clearRecents} disabled={recents.length === 0}>
          <Trash2 className="size-4" /> Clear recent destinations
        </Button>
      </div>

      <div className="mt-8 flex flex-col items-center gap-1 text-center text-xs text-ink-400">
        <Logo withText />
        <p>v0.1 · Made for Malaysian roads</p>
      </div>
    </PagePanel>
  );
}

function Heading({ children }: { children: ReactNode }) {
  return <h2 className="px-1 pb-2 pt-6 text-xs font-semibold uppercase tracking-wider text-ink-400">{children}</h2>;
}

function StatusRow({ label, value, ok }: { label: string; value: string; ok: boolean | null }) {
  const Icon = ok === null ? CircleDashed : ok ? CheckCircle2 : XCircle;
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <Icon className={cn('size-5 shrink-0', ok === null ? 'text-ink-300' : ok ? 'text-jade-500' : 'text-amber-500')} />
      <span className="flex-1 text-sm font-medium">{label}</span>
      <span className="text-right text-xs text-ink-500 dark:text-ink-400">{value}</span>
    </li>
  );
}
