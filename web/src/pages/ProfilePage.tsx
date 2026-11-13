import { CheckCircle2, CircleDashed, Laptop, LogOut, Moon, RefreshCw, Sun, Trash2, UserRound, XCircle } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { AuthForm } from '@/components/auth/AuthForm';
import { FeedbackSheet } from '@/components/feedback/FeedbackSheet';
import { OncomingSettings } from '@/components/navigation/OncomingSettings';
import { DeleteAccount } from '@/components/moderation/DeleteAccount';
import { fetchAdminStatus } from '@/services/adminAuth';
import { TOLL_PAYMENTS, useTollPayment } from '@/lib/tollPayment';
import { useEffect, useState } from 'react';
import { MessageSquareHeart, ShieldCheck } from 'lucide-react';
import { LogoMark } from '@/components/brand/LogoMark';
import { InstallSheet } from '@/components/pwa/InstallSheet';
import { useInstallPrompt } from '@/hooks/useInstallPrompt';
import { ShareAppCard } from '@/components/share/ShareAppCard';
import { Logo } from '@/components/layout/BottomNav';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/Button';
import { PagePanel } from '@/components/ui/PagePanel';
import { useLocation } from '@/contexts/LocationContext';
import { useSavedPlaces } from '@/contexts/SavedPlacesContext';
import { useServiceStatus } from '@/contexts/ServiceStatusContext';
import { useTheme, type ThemePreference } from '@/contexts/ThemeContext';
import { useProbeConsent } from '@/hooks/useProbeConsent';
import { hasVoiceFor, primeSpeech, speak, useVoiceAlerts, useVoiceLang } from '@/hooks/useVoiceAlerts';
import { Volume2 } from 'lucide-react';
import { features } from '@/lib/config';
import { cn } from '@/lib/cn';
import { useT } from '@/lib/i18n';

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
  const [t] = useT();
  const { preference, setPreference } = useTheme();
  const { server, searchMode, tilesMode, refresh } = useServiceStatus();
  const { status: gpsStatus, fix } = useLocation();
  const { favourites, recents, clearRecents } = useSavedPlaces();
  const [probeConsent, setProbeConsent] = useProbeConsent();

  return (
    <PagePanel title={t('Profil', 'Profile')}>
      <AccountCard favourites={favourites.length} recents={recents.length} />

      <ShareAppCard />
      <BusinessCard />
      <InstallCard />
      <FeedbackCard />

      <VoiceSettings />
      <TollPaymentSetting />
      <OncomingSettings />

      <Heading>{t('Paparan peta', 'Map appearance')}</Heading>
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
        <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-400">{t('Sumber data', 'Data sources')}</h2>
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

      <Heading>{t('Privasi', 'Privacy')}</Heading>
      <div className="mb-3 flex items-start gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-ink-200 dark:bg-ink-900 dark:ring-ink-800">
        <div className="min-w-0 flex-1">
          <p id="probe-label" className="text-sm font-semibold">{t('Kongsi data trafik tanpa nama', 'Share anonymous traffic data')}</p>
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
        <p className="mt-1 flex gap-3">
          <Link to="/privacy" className="font-semibold text-jade-700 hover:underline dark:text-jade-400">
            Privacy
          </Link>
          <Link to="/terms" className="font-semibold text-jade-700 hover:underline dark:text-jade-400">
            Terms
          </Link>
        </p>
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
  const [t] = useT();
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
      {user && <AccountExtras />}
      {!user && !loading && (
        <div className="mt-4 border-t border-ink-100 pt-4 dark:border-ink-800">
          {available && <p className="mb-3 text-sm text-ink-500 dark:text-ink-400">{t('Log masuk untuk melapor insiden dan mengesahkan laporan pemandu lain.', 'Sign in to report incidents and confirm other drivers’ reports.')}</p>}
          <AuthForm />
        </div>
      )}
    </div>
  );
}

function InstallCard() {
  const { env } = useInstallPrompt();
  const [open, setOpen] = useState(false);
  if (env === 'desktop') return null;
  const installed = env === 'installed';
  return (
    <div className="mt-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-ink-200 dark:bg-ink-900 dark:ring-ink-800">
      <div className="flex items-center gap-3">
        <LogoMark className="size-11" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{installed ? 'JalanGo sudah dipasang' : 'Pasang JalanGo'}</p>
          <p className="text-xs text-ink-500 dark:text-ink-400">{installed ? 'Anda sedang guna app dari skrin utama.' : 'Tambah ke skrin utama untuk navigasi skrin penuh.'}</p>
        </div>
        {installed ? (
          <CheckCircle2 className="size-6 text-jade-500" />
        ) : (
          <Button className="px-3 py-2 text-xs" onClick={() => setOpen(true)}>
            Pasang
          </Button>
        )}
      </div>
      {open && <InstallSheet onClose={() => setOpen(false)} />}
    </div>
  );
}

function VoiceSettings() {
  const [t] = useT();
  const [on, setOn] = useVoiceAlerts();
  const [lang, setLang] = useVoiceLang();
  const test = () => {
    primeSpeech();
    speak(lang === 'ms' ? 'Dalam 300 meter, belok kanan ke Jalan Tun Razak' : 'In 300 metres, turn right onto Jalan Tun Razak', lang);
  };
  return (
    <>
      <Heading>{t('Bahasa & suara', 'Language & voice')}</Heading>
      <div className="space-y-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-ink-200 dark:bg-ink-900 dark:ring-ink-800">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p id="voice-label" className="text-sm font-semibold">{t('Arahan & amaran bersuara', 'Spoken directions & alerts')}</p>
            <p className="text-xs text-ink-500 dark:text-ink-400">{t('“Dalam 300 meter, belok kanan…” dan amaran bahaya semasa navigasi. Pilihan bahasa di bawah juga menukar bahasa app.', '“In 300 metres, turn right…” and hazard warnings while navigating. The language below also sets the app language.')}</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={on}
            aria-labelledby="voice-label"
            onClick={() => setOn(!on)}
            className={cn('relative h-7 w-12 shrink-0 rounded-full transition', on ? 'bg-jade-500' : 'bg-ink-200 dark:bg-ink-700')}
          >
            <span className={cn('absolute top-0.5 size-6 rounded-full bg-white shadow transition-all', on ? 'left-[1.375rem]' : 'left-0.5')} />
          </button>
        </div>
        <div role="radiogroup" aria-label="Voice language" className="grid grid-cols-2 gap-1 rounded-xl bg-ink-100 p-1 dark:bg-ink-800">
          {(['ms', 'en'] as const).map((l) => (
            <button
              key={l}
              type="button"
              role="radio"
              aria-checked={lang === l}
              onClick={() => setLang(l)}
              className={cn('rounded-lg py-2 text-sm font-semibold', lang === l ? 'bg-white shadow-sm dark:bg-ink-600' : 'text-ink-500')}
            >
              {l === 'ms' ? 'Bahasa Melayu' : 'English'}
            </button>
          ))}
        </div>
        <Button variant="secondary" className="w-full" onClick={test} disabled={!on}>
          <Volume2 className="size-4" /> Test voice
        </Button>
        {lang === 'ms' && !hasVoiceFor('ms') && (
          <p className="text-xs text-amber-700 dark:text-amber-300">
            No Malay voice found on this device yet. Add one in your phone’s settings (iPhone: Accessibility → Spoken Content → Voices → Malay; Android: Text-to-speech → Google →
            install Malay). Until then your default voice is used.
          </p>
        )}
      </div>
    </>
  );
}

/** Profile → Cara bayar tol: used for toll plaza tips while navigating. */
function TollPaymentSetting() {
  const [t, lang] = useT();
  const [pay, setPay] = useTollPayment();
  return (
    <>
      <Heading>{t('Cara bayar tol', 'Toll payment')}</Heading>
      <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-ink-200 dark:bg-ink-900 dark:ring-ink-800">
        <p className="mb-2 text-xs text-ink-500 dark:text-ink-400">{t('Semasa navigasi, JalanGo beri amaran sebelum plaza tol dan ingatkan lorong yang sesuai.', 'While navigating, JalanGo warns you before toll plazas and reminds you which lanes to use.')}</p>
        <div role="radiogroup" aria-label={t('Cara bayar tol', 'Toll payment')} className="grid grid-cols-2 gap-1.5">
          {TOLL_PAYMENTS.map((p) => (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={pay === p.id}
              onClick={() => setPay(pay === p.id ? null : p.id)}
              className={cn('rounded-xl px-2 py-2.5 text-sm font-semibold ring-1', pay === p.id ? 'bg-sky-600 text-white ring-sky-600' : 'ring-ink-200 dark:ring-ink-700')}
            >
              {lang === 'en' ? p.en : p.ms}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

function FeedbackCard() {
  const [t] = useT();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 flex w-full items-center gap-3 rounded-2xl bg-white p-4 text-left shadow-sm ring-1 ring-ink-200 hover:ring-jade-500 dark:bg-ink-900 dark:ring-ink-800"
      >
        <MessageSquareHeart className="size-6 shrink-0 text-jade-500" />
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">{t('Hantar maklum balas', 'Send feedback')}</span>
          <span className="block text-xs text-ink-500 dark:text-ink-400">{t('Lapor masalah, data peta salah atau kongsi idea', 'Report a problem, wrong map data or share an idea')}</span>
        </span>
      </button>
      {open && <FeedbackSheet onClose={() => setOpen(false)} />}
    </>
  );
}

function AccountExtras() {
  const [admin, setAdmin] = useState(false);
  useEffect(() => {
    void fetchAdminStatus().then((s) => setAdmin(s.admin));
  }, []);
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 pt-3 dark:border-ink-800">
      {admin ? (
        <Link to="/admin" className="flex items-center gap-1.5 text-sm font-semibold text-jade-700 hover:underline dark:text-jade-400">
          <ShieldCheck className="size-4" /> Moderation
        </Link>
      ) : (
        <span />
      )}
      <DeleteAccount />
    </div>
  );
}

/** Entry to the marketplace operator sign-up (homestay / licensed car rental). */
function BusinessCard() {
  const [t] = useT();
  return (
    <Link to="/business" className="mt-3 flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-ink-200 dark:bg-ink-900 dark:ring-ink-800">
      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-sky-500/15 text-xl" aria-hidden>
        🏡
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{t('Ada homestay atau kereta sewa?', 'Own a homestay or rental car?')}</span>
        <span className="block text-xs text-ink-500 dark:text-ink-400">{t('Daftar bisnes anda di JalanGo, percuma 6 bulan pertama', 'List your business on JalanGo, free for the first 6 months')}</span>
      </span>
      <span className="text-sm font-semibold text-jade-600 dark:text-jade-400">{t('Daftar', 'Join')} →</span>
    </Link>
  );
}
