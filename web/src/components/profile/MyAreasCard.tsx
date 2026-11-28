import { Check, HelpCircle, Home, Loader2, MapPin, Plus, Store, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { NearbyQueueQuestion } from '@/components/places/NearbyQueueQuestion';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation } from '@/contexts/LocationContext';
import { useSavedPlaces } from '@/contexts/SavedPlacesContext';
import { useT, type Msg } from '@/lib/i18n';
import { fetchNearbyQueue, fetchNearbyUnverified, sendPoiFeedback, type NearbyPoi, type NearbyQueueRecord, type PoiFeedbackKind } from '@/services/poiFeedbackService';
import { loadAreas, MAX_AREAS, roughArea, saveAreas, type AreaKind, type MyArea } from '@/utils/myAreas';
import { formatDistance } from '@/utils/geo';

const KINDS: [AreaKind, Msg][] = [
  ['rumah', { ms: 'Rumah', en: 'Home' }],
  ['kerja', { ms: 'Tempat kerja', en: 'Work' }],
  ['ibu_bapa', { ms: 'Rumah ibu bapa', en: 'Parents’ home' }],
  ['mentua', { ms: 'Rumah mentua', en: 'In-laws’ home' }],
  ['lain', { ms: 'Lain-lain', en: 'Other' }],
];
const kindLabel = (k: AreaKind) => KINDS.find(([x]) => x === k)![1];

type Question = { area: MyArea; rough: { lat: number; lng: number } } & ({ type: 'queue'; r: NearbyQueueRecord } | { type: 'poi'; p: NearbyPoi });

/**
 * "Kawasan saya": places someone knows well, so they can help confirm the places
 * around them from anywhere. Kept on this phone only; questions and answers send
 * the area rounded to ~1 km, which the server uses and does not keep.
 */
export function MyAreasCard() {
  const [t] = useT();
  const { user } = useAuth();
  const { fix } = useLocation();
  const { favourites } = useSavedPlaces();
  const [areas, setAreas] = useState<MyArea[]>(() => loadAreas());
  const [adding, setAdding] = useState(false);
  const [kind, setKind] = useState<AreaKind>('rumah');
  const [from, setFrom] = useState<string>('here');
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const card = 'rounded-2xl bg-white p-4 shadow-sm ring-1 ring-ink-200 dark:bg-ink-900 dark:ring-ink-800';

  const update = (list: MyArea[]) => {
    setAreas(list);
    saveAreas(list);
    setQuestions(null);
  };
  const add = () => {
    const fav = favourites.find((f) => f.id === from);
    const at = from === 'here' ? fix?.coordinates : fav?.coordinates;
    if (!at) return setMsg(t('Lokasi semasa belum ada. Hidupkan lokasi atau pilih tempat disimpan.', 'No current location yet. Turn on location or pick a saved place.'));
    update([...areas, { id: `${Date.now()}`, kind, label: fav?.name ?? t(kindLabel(kind)), lat: at.lat, lng: at.lng }]);
    setAdding(false);
    setMsg(null);
  };

  const loadQuestions = async () => {
    setLoading(true);
    setMsg(null);
    try {
      const all: Question[] = [];
      for (const area of areas) {
        const rough = roughArea(area);
        const [queue, pois] = await Promise.all([fetchNearbyQueue(rough, 1500), fetchNearbyUnverified(rough, 1500)]);
        for (const r of queue) if (!all.some((q) => q.type === 'queue' && q.r.id === r.id)) all.push({ area, rough, type: 'queue', r });
        for (const p of pois) if (!all.some((q) => q.type === 'poi' && q.p.id === p.id)) all.push({ area, rough, type: 'poi', p });
      }
      setQuestions(all);
    } catch {
      setMsg(t('Tak dapat muat soalan. Cuba lagi.', 'Could not load questions. Try again.'));
    } finally {
      setLoading(false);
    }
  };
  const done = (q: Question) => setQuestions((l) => (l ?? []).filter((x) => x !== q));
  const answerPoi = async (q: Question & { type: 'poi' }, k: PoiFeedbackKind) => {
    try {
      await sendPoiFeedback(q.p.id, k, null, undefined, q.rough);
    } catch {
      /* counted or limited: move on */
    }
    done(q);
  };

  return (
    <div className={card}>
      <div className="flex items-center gap-2">
        <Home className="size-5 text-jade-600" />
        <p className="flex-1 font-semibold">{t('Kawasan saya', 'My areas')}</p>
        {areas.length < MAX_AREAS && !adding && (
          <Button variant="ghost" className="px-2 py-1 text-xs" onClick={() => setAdding(true)}>
            <Plus className="size-4" /> {t('Tambah', 'Add')}
          </Button>
        )}
      </div>
      <p className="mt-1 text-xs text-ink-500">
        {t(
          'Rumah, tempat kerja, rumah ibu bapa atau mentua: anda kenal tempat di sekitarnya. Bantu sahkan tempat di sana dari mana-mana. Disimpan dalam telefon ini sahaja; hanya kawasan anggaran (~1 km) dihantar semasa menjawab, dan tidak disimpan.',
          'Home, work, your parents’ or in-laws’ home: you know the places around them. Help confirm places there from anywhere. Kept on this phone only; only a rough area (~1 km) is sent when answering, and it is not kept.',
        )}
      </p>

      {areas.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {areas.map((a) => (
            <li key={a.id} className="flex items-center gap-2 rounded-xl bg-ink-100/70 px-3 py-2 text-sm dark:bg-ink-800/60">
              <MapPin className="size-4 shrink-0 text-ink-400" />
              <span className="min-w-0 flex-1 truncate">
                <span className="font-semibold">{t(kindLabel(a.kind))}</span>
                {a.label !== t(kindLabel(a.kind)) && <span className="text-ink-500"> · {a.label}</span>}
              </span>
              <button type="button" aria-label={t('Buang kawasan', 'Remove area')} onClick={() => update(areas.filter((x) => x.id !== a.id))} className="grid size-7 place-items-center rounded-full text-ink-400 hover:bg-ink-200 dark:hover:bg-ink-700">
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {adding && (
        <div className="mt-3 space-y-2 rounded-xl bg-ink-100/70 p-3 dark:bg-ink-800/60">
          <label className="block text-xs font-semibold text-ink-500">
            {t('Jenis', 'Kind')}
            <select value={kind} onChange={(e) => setKind(e.target.value as AreaKind)} className="mt-1 w-full rounded-xl bg-white px-3 py-2 text-sm text-ink-900 dark:bg-ink-900 dark:text-ink-50">
              {KINDS.map(([k, label]) => (
                <option key={k} value={k}>
                  {t(label)}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-semibold text-ink-500">
            {t('Lokasi', 'Location')}
            <select value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1 w-full rounded-xl bg-white px-3 py-2 text-sm text-ink-900 dark:bg-ink-900 dark:text-ink-50">
              <option value="here">{t('Lokasi saya sekarang', 'Where I am now')}</option>
              {favourites.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </label>
          <div className="flex gap-2">
            <Button className="px-3 py-1.5 text-xs" onClick={add}>
              <Check className="size-4" /> {t('Simpan', 'Save')}
            </Button>
            <Button variant="ghost" className="px-3 py-1.5 text-xs" onClick={() => setAdding(false)}>
              <X className="size-4" /> {t('Batal', 'Cancel')}
            </Button>
          </div>
        </div>
      )}

      {areas.length > 0 && user && questions === null && (
        <Button variant="secondary" className="mt-3 w-full" disabled={loading} onClick={() => void loadQuestions()}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : <HelpCircle className="size-4" />} {t('Bantu sahkan tempat di kawasan saya', 'Help confirm places in my areas')}
        </Button>
      )}
      {areas.length > 0 && !user && <p className="mt-2 text-xs text-ink-500">{t('Log masuk untuk bantu sahkan tempat.', 'Sign in to help confirm places.')}</p>}

      {questions && (
        <div className="mt-3 space-y-2">
          {questions.length === 0 && <p className="text-sm text-ink-500">{t('Tiada soalan buat masa ini. Terima kasih!', 'No questions for now. Thank you!')}</p>}
          {questions.slice(0, 5).map((q) =>
            q.type === 'queue' ? (
              <NearbyQueueQuestion key={`q:${q.r.id}`} r={q.r} at={null} area={q.rough} onDone={() => done(q)} onSkip={() => done(q)} />
            ) : (
              <div key={`p:${q.p.id}`} className="rounded-2xl bg-ink-100/70 p-3 text-sm dark:bg-ink-800/60">
                <p className="font-semibold">{t(`Adakah “${q.p.name}” masih beroperasi?`, `Is “${q.p.name}” still in business?`)}</p>
                <p className="text-xs text-ink-500">
                  {formatDistance(q.p.distance_m)} {t('dari', 'from')} {t(kindLabel(q.area.kind))}
                </p>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  <button type="button" onClick={() => void answerPoi(q, 'masih_beroperasi')} className="flex items-center justify-center gap-1 rounded-xl bg-jade-500 py-2 text-xs font-bold text-ink-950">
                    <Check className="size-4" /> {t('Masih beroperasi', 'Still in business')}
                  </button>
                  <button type="button" onClick={() => void answerPoi(q, 'sudah_tutup')} className="flex items-center justify-center gap-1 rounded-xl bg-red-600 py-2 text-xs font-bold text-white">
                    <Store className="size-4" /> {t('Sudah tutup terus', 'Closed for good')}
                  </button>
                  <button type="button" onClick={() => done(q)} className="flex items-center justify-center gap-1 rounded-xl bg-white py-2 text-xs font-semibold dark:bg-ink-900">
                    <HelpCircle className="size-4" /> {t('Tak pasti', 'Not sure')}
                  </button>
                </div>
              </div>
            ),
          )}
          {questions.length > 5 && <p className="text-xs text-ink-500">{t(`${questions.length - 5} soalan lagi selepas ini.`, `${questions.length - 5} more questions after these.`)}</p>}
        </div>
      )}
      {msg && (
        <p role="status" className="mt-2 text-xs text-ink-600 dark:text-ink-300">
          {msg}
        </p>
      )}
    </div>
  );
}
