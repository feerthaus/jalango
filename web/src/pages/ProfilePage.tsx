import { CheckCircle2, CircleDashed, Laptop, LogOut, Moon, RefreshCw, Sun, Trash2, UserRound, XCircle } from 'lucide-react';
import type { ReactNode } from 'react';
import { AuthForm } from '@/components/auth/AuthForm';
import { Logo } from '@/components/layout/BottomNav';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/Button';
import { PagePanel } from '@/components/ui/PagePanel';
import { useLocation } from '@/contexts/LocationContext';
import { useSavedPlaces } from '@/contexts/SavedPlacesContext';
import { useServiceStatus } from '@/contexts/ServiceStatusContext';
import { useTheme, type ThemePreference } from '@/contexts/ThemeContext';
import { useProbeConsent } from '@/hooks/useProbeConsent';
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
  const [probeConsent, setProbeConsent] = useProbeConsent();

  return (
    <PagePanel title="Profile">
      <AccountCard favourites={favourites.length} recents={recents.length} />

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
        <StatusRow
          label="Routing"
          ok={searchMode === 'checking' ? null : searchMode === 'live'}
          value={searchMode === 'checking' ? 'Checking…' : searchMode === 'live' ? 'Mapbox Directions (traffic-aware)' : 'Demo: straight-line preview'}
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
      <div className="mb-3 flex items-start gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-ink-200 dark:bg-ink-900 dark:ring-ink-800">
        <div className="min-w-0 flex-1">
          <p id="probe-label" className="text-sm font-semibold">Share anonymous traffic data</p>
          <p className="mt-0.5 text-xs text-ink-500 dark:text-ink-400">
            While navigating, send your speed and position without any account link, to build JalanGo’s own traffic layer. Nothing near
            your start or destination is sent. Raw data is deleted after 30 days.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={probeConsent === 'granted'}
          aria-labelledby="probe-label"
          onClick={() => setProbeConsent(probeConsent === 'granted' ? 'denied' : 'granted')}
          className={cn('relative h-7 w-12 shrink-0 rounded-full transition', probeConsent === 'granted' ? 'bg-jade-500' : 'bg-ink-200 dark:bg-ink-700')}
        >
          <span className={cn('absolute top-0.5 size-6 rounded-full bg-white shadow transition-all', probeConsent === 'granted' ? 'left-[1.375rem]' : 'left-0.5')} />
        </button>
      </div>
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

function AccountCard({ favourites, recents }: { favourites: number; recents: number }) {
  const { available, user, loading, signOut } = useAuth();
  const card = 'rounded-2xl bg-white p-4 shadow-sm ring-1 ring-ink-200 dark:bg-ink-900 dark:ring-ink-800';
  const name = (user?.user_metadata?.name as string | undefined) || user?.email?.split('@')[0];

  return (
    <div className={card}>
      <div className="flex items-center gap-4">
        <span className="grid size-14 shrink-0 place-items-center rounded-full bg-ink-100 text-lg font-bold text-ink-500 dark:bg-ink-800">
          {user ? (name ?? '?').slice(0, 1).toUpperCase() : <UserRound className="size-7 text-ink-400" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{user ? name : 'Guest'}</p>
          <p className="truncate text-sm text-ink-500 dark:text-ink-400">{user ? user.email : `${favourites} favourite${favourites === 1 ? '' : 's'} · ${recents} recent`}</p>
        </div>
        {user && (
          <Button variant="ghost" className="px-3" onClick={() => void signOut()}>
            <LogOut className="size-4" /> Sign out
          </Button>
        )}
      </div>
      {!user && !loading && (
        <div className="mt-4 border-t border-ink-100 pt-4 dark:border-ink-800">
          {available && <p className="mb-3 text-sm text-ink-500 dark:text-ink-400">Sign in to report incidents and confirm other drivers’ reports.</p>}
          <AuthForm />
        </div>
      )}
    </div>
  );
}
