import { Check, Copy, Crown, Flag, Loader2, LogOut, MapPin, MessageCircle, Navigation, Share2, ShieldCheck, UserMinus, Users } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { AuthForm } from '@/components/auth/AuthForm';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { useAuth } from '@/contexts/AuthContext';
import { useConvoy, type ConvoyPlace } from '@/contexts/ConvoyContext';
import { useLocation } from '@/contexts/LocationContext';
import { useRouting } from '@/contexts/RoutingContext';
import { cn } from '@/lib/cn';
import { convoyUrl, type ConvoyMember } from '@/services/convoyService';
import { formatConvoyCode, memberPosition, memberStatus, normalizeConvoyCode, type MemberStatus } from '@/utils/convoy';
import { formatDistance, haversineMeters } from '@/utils/geo';

function defaultName(user: ReturnType<typeof useAuth>['user']): string {
  return ((user?.user_metadata?.name as string | undefined) || user?.email?.split('@')[0] || '').slice(0, 40);
}

/** Create / join a convoy, or manage the one you're in. */
export function ConvoySheet({ onClose, joinCode }: { onClose: () => void; joinCode?: string | null }) {
  const { user } = useAuth();
  const { available, convoy } = useConvoy();
  if (!user) {
    return (
      <Sheet title="Konvoi" onClose={onClose}>
        <p className="mb-3 text-sm text-ink-600 dark:text-ink-300">Log masuk supaya rakan konvoi tahu itu memang anda. / Sign in so your group knows it’s you.</p>
        <AuthForm compact />
      </Sheet>
    );
  }
  if (!available) {
    return (
      <Sheet title="Konvoi" onClose={onClose}>
        <p className="text-sm text-ink-500">Konvoi belum disambungkan. / Convoy isn’t connected yet.</p>
      </Sheet>
    );
  }
  return (
    <Sheet title={convoy ? convoy.name : 'Konvoi'} onClose={onClose}>
      {convoy ? <ConvoyPanel onClose={onClose} /> : <StartConvoy joinCode={joinCode ?? null} />}
    </Sheet>
  );
}

function StartConvoy({ joinCode }: { joinCode: string | null }) {
  const { user } = useAuth();
  const { create, join } = useConvoy();
  const { destination: routeDest, status } = useRouting();
  const [tab, setTab] = useState<'create' | 'join'>(joinCode ? 'join' : 'create');
  const [displayName, setDisplayName] = useState(defaultName(user));
  const [name, setName] = useState('');
  const [code, setCode] = useState(joinCode ? formatConvoyCode(joinCode) : '');
  const [useDest, setUseDest] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasDest = Boolean(routeDest && status !== 'idle');

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      if (tab === 'create') {
        await create({ name: name || 'Konvoi', displayName, destination: hasDest && useDest && routeDest ? { name: routeDest.name, coordinates: routeDest.coordinates } : null });
      } else {
        const c = normalizeConvoyCode(code);
        if (!c) throw new Error('Kod mesti 8 aksara, cth K7M4-QX2P. / Code must be 8 characters.');
        await join(c, displayName);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-600 dark:text-ink-300">
        Jalan beramai-ramai: semua ahli nampak kereta masing-masing di peta, destinasi sama, dan amaran suara jika ada yang ketinggalan.
      </p>
      <div role="tablist" className="grid grid-cols-2 gap-1 rounded-2xl bg-ink-100 p-1 dark:bg-ink-800">
        {(['create', 'join'] as const).map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={cn('rounded-xl py-2 text-sm font-semibold', tab === t ? 'bg-white shadow dark:bg-ink-900' : 'text-ink-500')}>
            {t === 'create' ? 'Mula konvoi' : 'Sertai dengan kod'}
          </button>
        ))}
      </div>
      {tab === 'join' && (
        <Field label="Kod konvoi / Convoy code">
          <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={9} placeholder="K7M4-QX2P" autoCapitalize="characters" className="input font-mono tracking-widest" />
        </Field>
      )}
      {tab === 'create' && (
        <Field label="Nama konvoi / Convoy name">
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="cth. Balik kampung Ipoh" className="input" />
        </Field>
      )}
      <Field label="Nama anda dalam konvoi / Your name">
        <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={40} placeholder="cth. Firdaus" className="input" />
      </Field>
      {tab === 'create' && hasDest && routeDest && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={useDest} onChange={(e) => setUseDest(e.target.checked)} className="size-4 accent-jade-500" />
          Destinasi: <strong className="truncate">{routeDest.name}</strong>
        </label>
      )}
      <p className="flex items-start gap-2 text-xs text-ink-500 dark:text-ink-400">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-jade-500" />
        Hanya ahli konvoi nampak lokasi terkini anda (bukan sejarah). Konvoi tamat sendiri selepas 12 jam, dan anda boleh keluar bila-bila masa.
      </p>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <Button className="w-full py-3" onClick={submit} disabled={busy || !displayName.trim() || (tab === 'join' && !code.trim())}>
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Users className="size-4" />} {tab === 'create' ? 'Mula konvoi' : 'Sertai konvoi'}
      </Button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-sm [&_.input]:mt-1 [&_.input]:w-full [&_.input]:rounded-xl [&_.input]:bg-ink-100 [&_.input]:px-3 [&_.input]:py-2.5 [&_.input]:text-base [&_.input]:outline-none [&_.input]:ring-jade-500 [&_.input:focus]:ring-2 dark:[&_.input]:bg-ink-800">
      <span className="font-medium">{label}</span>
      {children}
    </label>
  );
}

const STATUS_TEXT: Record<MemberStatus, string> = {
  arrived: 'Sudah tiba',
  offline: 'Isyarat hilang',
  waiting: 'Menunggu GPS',
  stopped: 'Berhenti',
  moving: 'Bergerak',
};

function ConvoyPanel({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const { fix } = useLocation();
  const { destination: routeDest, status } = useRouting();
  const c = useConvoy();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const convoy = c.convoy!;

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(null);
    }
  };

  const go = (which: 'destination' | 'meet') => {
    c.navigateTo(which);
    onClose();
  };

  const hours = Math.max(0, (Date.parse(convoy.expires_at) - Date.now()) / 3_600_000);

  return (
    <div className="space-y-4">
      <ConvoyCode code={convoy.code} name={convoy.name} />

      <section className="space-y-2">
        <PlaceRow icon={<Flag className="size-4" />} color="#0ea5e9" title="Destinasi" place={c.destination} onGo={() => go('destination')} />
        <PlaceRow icon={<MapPin className="size-4" />} color="#a855f7" title="Titik berkumpul" place={c.meetPoint} onGo={() => go('meet')} />
        {c.isLeader && (
          <div className="flex flex-wrap gap-2">
            {routeDest && status !== 'idle' && (
              <Button variant="secondary" className="text-xs" disabled={busy !== null} onClick={() => run('dest', () => c.setDestination({ name: routeDest.name, coordinates: routeDest.coordinates }))}>
                <Flag className="size-3.5" /> Jadikan “{routeDest.name.slice(0, 18)}” destinasi
              </Button>
            )}
            {fix && (
              <Button variant="secondary" className="text-xs" disabled={busy !== null} onClick={() => run('meet', () => c.setMeetPoint({ name: 'Lokasi ketua', coordinates: fix.coordinates }))}>
                <MapPin className="size-3.5" /> Berkumpul di lokasi saya
              </Button>
            )}
            {c.meetPoint && (
              <Button variant="ghost" className="text-xs" disabled={busy !== null} onClick={() => run('meet-clear', () => c.setMeetPoint(null))}>
                Buang titik berkumpul
              </Button>
            )}
          </div>
        )}
        {c.isLeader && <p className="text-xs text-ink-500">Tip: cari tempat (cth. R&amp;R), kemudian tekan “Titik berkumpul” pada kad tempat itu.</p>}
      </section>

      <section>
        <h3 className="mb-2 flex items-center justify-between text-sm font-bold">
          <span>{c.members.length} kereta</span>
          <span className={cn('text-xs font-medium', c.live ? 'text-jade-600' : 'text-ink-400')}>{c.live ? '● Langsung' : '○ Kemas kini berkala'}</span>
        </h3>
        <ul className="divide-y divide-ink-100 rounded-2xl bg-ink-50 dark:divide-ink-800 dark:bg-ink-800/50">
          {c.members.map((m) => (
            <MemberRow
              key={m.user_id}
              m={m}
              isMe={m.user_id === user?.id}
              isLeader={m.user_id === convoy.leader_id}
              from={fix?.coordinates ?? null}
              dest={c.destination}
              canRemove={c.isLeader && m.user_id !== user?.id}
              busy={busy === `rm:${m.user_id}`}
              onRemove={() => run(`rm:${m.user_id}`, () => c.remove(m.user_id))}
            />
          ))}
        </ul>
      </section>

      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <p className="text-xs text-ink-500">Tamat automatik dalam {hours >= 1 ? `${Math.floor(hours)} jam` : `${Math.round(hours * 60)} minit`}. Hanya ahli nampak lokasi anda.</p>

      {c.isLeader ? (
        confirmEnd ? (
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={() => setConfirmEnd(false)}>Batal</Button>
            <Button variant="danger" disabled={busy !== null} onClick={() => run('end', c.end)}>
              {busy === 'end' ? <Loader2 className="size-4 animate-spin" /> : null} Ya, tamatkan
            </Button>
          </div>
        ) : (
          <Button variant="danger" className="w-full" onClick={() => setConfirmEnd(true)}>
            Tamatkan konvoi untuk semua
          </Button>
        )
      ) : (
        <Button variant="secondary" className="w-full" disabled={busy !== null} onClick={() => run('leave', c.leave)}>
          <LogOut className="size-4" /> Keluar konvoi
        </Button>
      )}
    </div>
  );
}

function PlaceRow({ icon, color, title, place, onGo }: { icon: ReactNode; color: string; title: string; place: ConvoyPlace | null; onGo: () => void }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-ink-50 p-3 dark:bg-ink-800/50">
      <span className="grid size-8 shrink-0 place-items-center rounded-full text-white" style={{ background: color }}>{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-ink-500">{title}</p>
        <p className="truncate text-sm font-semibold">{place ? place.name : 'Belum ditetapkan'}</p>
      </div>
      {place && (
        <Button variant="secondary" className="h-9 px-3 text-xs" onClick={onGo} aria-label={`Navigate to ${title}`}>
          <Navigation className="size-3.5" /> Pergi
        </Button>
      )}
    </div>
  );
}

function MemberRow({ m, isMe, isLeader, from, dest, canRemove, busy, onRemove }: {
  m: ConvoyMember; isMe: boolean; isLeader: boolean; from: { lat: number; lng: number } | null; dest: ConvoyPlace | null; canRemove: boolean; busy: boolean; onRemove: () => void;
}) {
  const pos = memberPosition(m);
  const st = memberStatus(m);
  const away = !isMe && pos && from ? haversineMeters(from, pos) : null;
  const toDest = pos && dest ? haversineMeters(pos, dest.coordinates) : null;
  const etaMin = m.eta_at ? Math.max(0, Math.round((Date.parse(m.eta_at) - Date.now()) / 60_000)) : null;
  return (
    <li className="flex items-center gap-3 p-3">
      <span className="size-3.5 shrink-0 rounded-full ring-2 ring-white dark:ring-ink-900" style={{ background: m.color }} />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1 truncate text-sm font-semibold">
          {m.display_name}
          {isMe && <span className="text-xs font-normal text-ink-400">(anda)</span>}
          {isLeader && <Crown className="size-3.5 text-amber-500" aria-label="Leader" />}
        </p>
        <p className="truncate text-xs text-ink-500">
          <span className={cn(st === 'offline' && 'text-amber-600', st === 'arrived' && 'text-jade-600')}>{STATUS_TEXT[st]}</span>
          {away !== null && ` · ${formatDistance(away)} dari anda`}
          {st !== 'arrived' && toDest !== null && ` · ${formatDistance(toDest)} ke destinasi`}
          {st !== 'arrived' && etaMin !== null && ` · ETA ${etaMin} min`}
        </p>
      </div>
      {canRemove && (
        <button type="button" onClick={onRemove} disabled={busy} aria-label={`Remove ${m.display_name}`} className="grid size-8 place-items-center rounded-full text-ink-400 hover:bg-red-500/10 hover:text-red-600">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <UserMinus className="size-4" />}
        </button>
      )}
    </li>
  );
}

function ConvoyCode({ code, name }: { code: string; name: string }) {
  const [copied, setCopied] = useState(false);
  const url = convoyUrl(code);
  const text = `Jom sertai konvoi “${name}” di JalanGo. Kod: ${formatConvoyCode(code)}`;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };
  return (
    <div className="rounded-2xl bg-jade-500/10 p-3">
      <p className="text-xs text-ink-500">Kod konvoi</p>
      <p className="font-mono text-2xl font-black tracking-[0.2em] text-jade-700 dark:text-jade-300" data-testid="convoy-code">{formatConvoyCode(code)}</p>
      <div className="mt-2 grid grid-cols-3 gap-2">
        <a href={`https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-1.5 rounded-xl bg-[#25D366] py-2 text-sm font-semibold text-white">
          <MessageCircle className="size-4" /> WhatsApp
        </a>
        <Button variant="secondary" onClick={copy}>
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />} {copied ? 'Disalin' : 'Salin'}
        </Button>
        <Button variant="secondary" onClick={() => navigator.share?.({ title: 'JalanGo Konvoi', text, url }).catch(() => {})} disabled={typeof navigator.share !== 'function'}>
          <Share2 className="size-4" /> Lain
        </Button>
      </div>
    </div>
  );
}
