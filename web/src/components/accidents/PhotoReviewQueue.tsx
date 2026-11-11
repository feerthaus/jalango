import { Check, Loader2, RefreshCw, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatDay, outcomeLabel, vehicleLabel } from '@/lib/accidentLabels';
import { fetchPendingPhotos, photoUrls, reviewAccidentPhoto } from '@/services/accidentService';
import type { AccidentRecord } from '@/types';

/** Admin: approve or reject accident photos before anyone else sees them. */
export function PhotoReviewQueue() {
  const [items, setItems] = useState<AccidentRecord[] | null>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    fetchPendingPhotos()
      .then(async (list) => {
        setItems(list);
        setUrls(await photoUrls(list.map((r) => r.photo_path!).filter(Boolean)));
      })
      .catch((e: Error) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  const review = async (id: string, approve: boolean) => {
    setBusy(id);
    try {
      await reviewAccidentPhoto(id, approve);
      setItems((l) => l?.filter((r) => r.id !== id) ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setBusy(null);
    }
  };

  if (error) return <p role="alert" className="text-sm text-red-600">{error}</p>;
  if (!items) return <Loader2 className="mx-auto size-6 animate-spin text-ink-400" />;
  if (items.length === 0) return <EmptyState icon={Check} title="Tiada gambar untuk disemak">Semua gambar kemalangan sudah disemak.</EmptyState>;
  return (
    <>
      <p className="mb-2 rounded-xl bg-amber-400/15 p-3 text-xs text-amber-900 dark:text-amber-200">
        Tolak gambar yang menunjukkan mangsa, darah, muka yang jelas, nombor plat yang boleh dibaca, atau yang bukan gambar lokasi kemalangan.
      </p>
      <div className="mb-2 flex justify-end">
        <Button variant="ghost" className="px-2 py-1 text-xs" onClick={load}>
          <RefreshCw className="size-3.5" /> Muat semula
        </Button>
      </div>
      <ul className="space-y-3">
        {items.map((r) => (
          <li key={r.id} className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-ink-200 dark:bg-ink-900 dark:ring-ink-800">
            {r.photo_path && urls[r.photo_path] ? (
              <img src={urls[r.photo_path]} alt="Gambar untuk disemak" className="max-h-80 w-full rounded-xl object-contain" />
            ) : (
              <p className="text-xs text-ink-500">Gambar tidak dapat dimuat.</p>
            )}
            <p className="mt-2 text-sm">
              {formatDay(r.occurred_on, 'ms')} · {r.vehicles.map((v) => vehicleLabel(v, 'ms')).join(' & ') || '—'} · {outcomeLabel(r.outcome, 'ms')}
            </p>
            {r.note && <p className="text-xs italic text-ink-500">“{r.note}”</p>}
            <a className="text-xs text-sky-600" href={`https://www.google.com/maps/search/?api=1&query=${r.latitude},${r.longitude}`} target="_blank" rel="noreferrer">
              {r.latitude.toFixed(5)}, {r.longitude.toFixed(5)}
            </a>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Button disabled={busy === r.id} onClick={() => void review(r.id, true)}>
                <Check className="size-4" /> Lulus
              </Button>
              <Button variant="danger" disabled={busy === r.id} onClick={() => void review(r.id, false)}>
                <X className="size-4" /> Tolak
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
