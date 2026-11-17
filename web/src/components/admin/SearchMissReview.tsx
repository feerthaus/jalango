import { Check, EyeOff, Flag, Loader2, MapPin, Pin, Plus, RefreshCw, Replace, SearchX, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { cn } from '@/lib/cn';
import { placeFromLink, searchPlaces } from '@/services/geocodingService';
import {
  addSearchPlace,
  addSearchSynonym,
  fetchSearchMisses,
  fetchSearchRules,
  retireSearchRule,
  setSearchMissStatus,
  type SearchMissRow,
  type SearchPlaceRow,
  type SearchSynonymRow,
} from '@/services/searchAdmin';
import type { Place } from '@/types';
import { formatRelativeTime } from '@/utils/format';

/**
 * Admin → Carian. Searches people reported ("Tak jumpa?"), that found nothing,
 * or where nothing was tapped, most wanted first. Fix one for everyone with a
 * synonym, by pinning the right result, or by adding the place.
 */
export function SearchMissReview() {
  const [misses, setMisses] = useState<SearchMissRow[] | null>(null);
  const [rules, setRules] = useState<{ synonyms: SearchSynonymRow[]; places: SearchPlaceRow[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    Promise.all([fetchSearchMisses(), fetchSearchRules()])
      .then(([m, r]) => {
        setMisses(m);
        setRules(r);
      })
      .catch((e: Error) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  if (error) return <p role="alert" className="text-sm text-red-600">{error}</p>;
  if (!misses || !rules) return <Loader2 className="mx-auto size-6 animate-spin text-ink-400" />;

  return (
    <div className="space-y-6">
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-bold">Carian yang gagal</h2>
          <Button variant="ghost" className="px-2 py-1 text-xs" onClick={load}>
            <RefreshCw className="size-3.5" /> Refresh
          </Button>
        </div>
        <p className="mb-3 text-xs text-ink-500">
          Laporan "Tak jumpa?" dan carian tanpa hasil dikira. Hanya teks carian disimpan, tanpa pengguna atau lokasi, dan dipadam selepas 90 hari. Nombor merah: dilaporkan, atau tiada hasil 3 kali atau lebih.
        </p>
        {misses.length === 0 ? (
          <EmptyState icon={Check} title="Tiada carian gagal">Semua carian terkini menemui tempat. 🎉</EmptyState>
        ) : (
          <ul className="space-y-3">
            {misses.map((m) => (
              <MissItem key={m.query_norm} miss={m} onDone={load} />
            ))}
          </ul>
        )}
      </section>

      <RulesList rules={rules} onChange={load} />
    </div>
  );
}

type Mode = null | 'synonym' | 'pin' | 'place';

function MissItem({ miss, onDone }: { miss: SearchMissRow; onDone: () => void }) {
  const [mode, setMode] = useState<Mode>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const urgent = miss.reports > 0 || miss.no_results >= 3;

  const act = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal');
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className={cn('rounded-2xl bg-white p-4 shadow-sm ring-1 dark:bg-ink-900', urgent ? 'ring-red-300 dark:ring-red-900' : 'ring-ink-200 dark:ring-ink-800')}>
      <div className="flex items-start gap-2">
        <p className="min-w-0 flex-1 text-base font-bold">“{miss.sample}”</p>
        <span className="shrink-0 text-xs text-ink-400">{formatRelativeTime(miss.last_at)}</span>
      </div>
      <div className="mt-1 flex flex-wrap gap-1.5 text-[11px] font-semibold">
        {miss.reports > 0 && <Chip tone="red"><Flag className="size-3" /> Dilaporkan {miss.reports}×</Chip>}
        {miss.no_results > 0 && <Chip tone="amber"><SearchX className="size-3" /> Tiada hasil {miss.no_results}×</Chip>}
        {miss.no_click > 0 && <Chip tone="ink">Tiada yang ditekan {miss.no_click}×</Chip>}
      </div>
      {miss.last_note && <p className="mt-2 text-sm italic text-ink-600 dark:text-ink-300">“{miss.last_note}”</p>}
      {miss.hint_lat !== null && miss.hint_lng !== null && (
        <p className="mt-2 flex items-start gap-1.5 text-sm">
          <MapPin className="mt-0.5 size-4 shrink-0 text-jade-600" />
          <span>
            Pengguna tunjuk: <strong>{miss.hint_name ?? 'Lokasi'}</strong>{' '}
            <a className="text-xs text-jade-700 underline dark:text-jade-300" href={`https://www.google.com/maps?q=${miss.hint_lat},${miss.hint_lng}`} target="_blank" rel="noopener noreferrer">
              {miss.hint_lat.toFixed(5)}, {miss.hint_lng.toFixed(5)}
            </a>
          </span>
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant={mode === 'pin' ? 'primary' : 'secondary'} className="px-3 py-1.5 text-xs" onClick={() => setMode(mode === 'pin' ? null : 'pin')}>
          <Pin className="size-3.5" /> Pin hasil yang betul
        </Button>
        <Button variant={mode === 'place' ? 'primary' : 'secondary'} className="px-3 py-1.5 text-xs" onClick={() => setMode(mode === 'place' ? null : 'place')}>
          <Plus className="size-3.5" /> Tambah tempat
        </Button>
        <Button variant={mode === 'synonym' ? 'primary' : 'secondary'} className="px-3 py-1.5 text-xs" onClick={() => setMode(mode === 'synonym' ? null : 'synonym')}>
          <Replace className="size-3.5" /> Sinonim
        </Button>
        <Button variant="ghost" className="px-3 py-1.5 text-xs" disabled={busy} onClick={() => void act(() => setSearchMissStatus(miss.query_norm, 'fixed'))}>
          <Check className="size-3.5" /> Dah okey
        </Button>
        <Button variant="ghost" className="px-3 py-1.5 text-xs text-ink-500" disabled={busy} onClick={() => void act(() => setSearchMissStatus(miss.query_norm, 'ignored'))}>
          <EyeOff className="size-3.5" /> Abai
        </Button>
        {busy && <Loader2 className="size-4 animate-spin self-center text-ink-400" />}
      </div>
      {error && <p role="alert" className="mt-2 text-xs text-red-600">{error}</p>}

      {mode === 'pin' && <PinForm miss={miss} busy={busy} onSave={(p) => act(() => addSearchPlace(p, miss.query_norm))} />}
      {mode === 'place' && <PlaceForm miss={miss} busy={busy} onSave={(p) => act(() => addSearchPlace(p, miss.query_norm))} />}
      {mode === 'synonym' && <SynonymForm miss={miss} busy={busy} onSave={(w, alts) => act(() => addSearchSynonym(w, alts, miss.query_norm))} />}
    </li>
  );
}

type NewPlace = { name: string; address: string; lat: number; lng: number; keywords: string[] };

/** Search again (as typed or reworded) and pin the right result for this search text. */
function PinForm({ miss, busy, onSave }: { miss: SearchMissRow; busy: boolean; onSave: (p: NewPlace) => void }) {
  const [q, setQ] = useState(miss.sample);
  const [results, setResults] = useState<Place[] | null>(null);
  const [loading, setLoading] = useState(false);
  const run = async () => {
    setLoading(true);
    try {
      const near = miss.hint_lat !== null && miss.hint_lng !== null ? { lat: miss.hint_lat, lng: miss.hint_lng } : null;
      setResults((await searchPlaces(q, { near, live: true })).results);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="mt-3 rounded-xl bg-ink-50 p-3 dark:bg-ink-800/60">
      <p className="mb-2 text-xs text-ink-500">Cari dengan perkataan lain kalau perlu (cth. "stesen ktmb gemas"), kemudian pilih tempat yang betul. Ia akan keluar paling atas untuk “{miss.sample}”.</p>
      <div className="flex gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void run()} className="min-w-0 flex-1 rounded-lg bg-white px-3 py-2 text-sm dark:bg-ink-900" />
        <Button variant="secondary" className="px-3 py-2 text-xs" onClick={() => void run()} disabled={loading}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : 'Cari'}
        </Button>
      </div>
      {results && results.length === 0 && <p className="mt-2 text-xs text-ink-500">Tiada hasil. Guna "Tambah tempat".</p>}
      <ul className="mt-2 space-y-1">
        {results?.slice(0, 6).map((p) => (
          <li key={p.id} className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm dark:bg-ink-900">
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">{p.name}</span>
              <span className="block truncate text-xs text-ink-500">{p.address}</span>
            </span>
            <Button className="shrink-0 px-2.5 py-1 text-xs" disabled={busy} onClick={() => onSave({ name: p.name, address: p.address, lat: p.coordinates.lat, lng: p.coordinates.lng, keywords: [miss.query_norm] })}>
              <Pin className="size-3.5" /> Pin
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** A place the map doesn't have: from the user's link, a Google Maps link or "lat, lng". */
function PlaceForm({ miss, busy, onSave }: { miss: SearchMissRow; busy: boolean; onSave: (p: NewPlace) => void }) {
  const [name, setName] = useState(miss.hint_name ?? miss.sample);
  const [address, setAddress] = useState('');
  const [where, setWhere] = useState(miss.hint_lat !== null && miss.hint_lng !== null ? `${miss.hint_lat}, ${miss.hint_lng}` : '');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(miss.hint_lat !== null && miss.hint_lng !== null ? { lat: miss.hint_lat, lng: miss.hint_lng } : null);
  const [err, setErr] = useState<string | null>(null);
  const [keywords, setKeywords] = useState(miss.query_norm);

  const read = async () => {
    setErr(null);
    setCoords(null);
    try {
      const p = await placeFromLink(where);
      if (!p) return setErr('Tak dapat baca lokasi. Guna pautan Google Maps atau "lat, lng" di Malaysia.');
      setCoords(p.coordinates);
      if (!address && p.address && !/^-?\d/.test(p.address)) setAddress(p.address);
    } catch {
      setErr('Tak dapat semak sekarang.');
    }
  };

  return (
    <div className="mt-3 space-y-2 rounded-xl bg-ink-50 p-3 text-sm dark:bg-ink-800/60">
      <label className="block">
        <span className="text-xs font-semibold">Nama tempat</span>
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} className="mt-0.5 w-full rounded-lg bg-white px-3 py-2 dark:bg-ink-900" />
      </label>
      <label className="block">
        <span className="text-xs font-semibold">Alamat ringkas (pilihan)</span>
        <input value={address} onChange={(e) => setAddress(e.target.value)} maxLength={200} placeholder="cth. Gemas, Negeri Sembilan" className="mt-0.5 w-full rounded-lg bg-white px-3 py-2 dark:bg-ink-900" />
      </label>
      <label className="block">
        <span className="text-xs font-semibold">Lokasi: pautan Google Maps atau "lat, lng"</span>
        <div className="mt-0.5 flex gap-2">
          <input value={where} onChange={(e) => setWhere(e.target.value)} onBlur={() => void read()} className="min-w-0 flex-1 rounded-lg bg-white px-3 py-2 dark:bg-ink-900" />
          <Button variant="secondary" className="px-3 py-2 text-xs" onClick={() => void read()}>Semak</Button>
        </div>
      </label>
      {coords && (
        <p className="text-xs text-jade-700 dark:text-jade-300">
          ✓ {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}{' '}
          <a className="underline" href={`https://www.google.com/maps?q=${coords.lat},${coords.lng}`} target="_blank" rel="noopener noreferrer">semak di peta</a>
        </p>
      )}
      {err && <p className="text-xs text-red-600">{err}</p>}
      <label className="block">
        <span className="text-xs font-semibold">Kata carian (dipisah koma)</span>
        <input value={keywords} onChange={(e) => setKeywords(e.target.value)} className="mt-0.5 w-full rounded-lg bg-white px-3 py-2 dark:bg-ink-900" />
      </label>
      <p className="text-[11px] text-ink-500">Hanya nama, alamat dan koordinat disimpan (bukan data Google). Tempat ini keluar paling atas bila carian mengandungi nama atau kata carian di atas.</p>
      <Button
        className="w-full py-2"
        disabled={busy || !coords || name.trim().length < 2}
        onClick={() => coords && onSave({ name: name.trim(), address: address.trim(), lat: coords.lat, lng: coords.lng, keywords: keywords.split(',').map((k) => k.trim()).filter(Boolean) })}
      >
        Simpan tempat
      </Button>
    </div>
  );
}

/** One word → 1–3 alternatives, e.g. ktm → stesen ktmb. Applies to every search with that word. */
function SynonymForm({ miss, busy, onSave }: { miss: SearchMissRow; busy: boolean; onSave: (word: string, alts: string[]) => void }) {
  const [word, setWord] = useState(miss.query_norm.split(' ')[0] ?? '');
  const [alts, setAlts] = useState('');
  return (
    <div className="mt-3 space-y-2 rounded-xl bg-ink-50 p-3 text-sm dark:bg-ink-800/60">
      <p className="text-xs text-ink-500">Bila hasil teratas tak mengandungi semua perkataan, JalanGo cuba juga gantian ini. Berkesan untuk semua carian dengan perkataan itu.</p>
      <div className="flex items-center gap-2">
        <input value={word} onChange={(e) => setWord(e.target.value.toLowerCase().replace(/\s/g, ''))} maxLength={20} aria-label="Perkataan" className="w-28 rounded-lg bg-white px-3 py-2 dark:bg-ink-900" />
        <span className="text-ink-400">→</span>
        <input value={alts} onChange={(e) => setAlts(e.target.value)} placeholder="stesen ktmb, ktm station" aria-label="Gantian" className="min-w-0 flex-1 rounded-lg bg-white px-3 py-2 dark:bg-ink-900" />
      </div>
      <Button
        className="w-full py-2"
        disabled={busy || word.length < 2 || !alts.trim()}
        onClick={() => onSave(word, alts.split(',').map((a) => a.trim()).filter(Boolean).slice(0, 3))}
      >
        Simpan sinonim
      </Button>
    </div>
  );
}

function RulesList({ rules, onChange }: { rules: { synonyms: SearchSynonymRow[]; places: SearchPlaceRow[] }; onChange: () => void }) {
  const retire = async (kind: 'synonym' | 'place', id: string | number) => {
    if (!window.confirm('Matikan peraturan ini?')) return;
    await retireSearchRule(kind, id);
    onChange();
  };
  return (
    <section>
      <h2 className="mb-2 text-sm font-bold">Pembetulan aktif</h2>
      {rules.synonyms.length === 0 && rules.places.length === 0 && <p className="text-xs text-ink-500">Belum ada. Sinonim terbina (ktm, lrt, mrt, hosp, rnr, masjid) sentiasa aktif.</p>}
      <ul className="space-y-2">
        {rules.places.map((p) => (
          <li key={p.id} className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm ring-1 ring-ink-200 dark:bg-ink-900 dark:ring-ink-800">
            <Pin className="size-4 shrink-0 text-jade-600" />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">{p.name}</span>
              <span className="block truncate text-xs text-ink-500">untuk: {p.keywords.join(', ') || p.name}</span>
            </span>
            <button type="button" aria-label={`Matikan ${p.name}`} onClick={() => void retire('place', p.id)} className="grid size-8 place-items-center rounded-full text-ink-400 hover:bg-ink-100 hover:text-red-600 dark:hover:bg-ink-800">
              <Trash2 className="size-4" />
            </button>
          </li>
        ))}
        {rules.synonyms.map((s) => (
          <li key={s.id} className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm ring-1 ring-ink-200 dark:bg-ink-900 dark:ring-ink-800">
            <Replace className="size-4 shrink-0 text-violet-600" />
            <span className="min-w-0 flex-1 truncate">
              <strong>{s.word}</strong> → {s.alternatives.join(', ')}
            </span>
            <button type="button" aria-label={`Matikan ${s.word}`} onClick={() => void retire('synonym', s.id)} className="grid size-8 place-items-center rounded-full text-ink-400 hover:bg-ink-100 hover:text-red-600 dark:hover:bg-ink-800">
              <Trash2 className="size-4" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Chip({ tone, children }: { tone: 'red' | 'amber' | 'ink'; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        'flex items-center gap-1 rounded-full px-2 py-0.5',
        tone === 'red' ? 'bg-red-500/10 text-red-700 dark:text-red-300' : tone === 'amber' ? 'bg-amber-400/20 text-amber-800 dark:text-amber-200' : 'bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-ink-300',
      )}
    >
      {children}
    </span>
  );
}
