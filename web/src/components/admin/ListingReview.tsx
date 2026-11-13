import { Check, Loader2, MapPin, RefreshCw, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { cn } from '@/lib/cn';
import { AMENITIES, FUELS, HOMESTAY_TYPES, LISTING_STATUS, PHOTO_STATUS, rm } from '@/lib/listingLabels';
import { fetchListingsForReview, listingPhotoUrls, reviewListing, reviewListingPhoto, type ListingForReview, type ListingPhoto } from '@/services/listingService';

/** Admin: review new / changed listings and every new photo before anyone sees them. */
export function ListingReview() {
  const [items, setItems] = useState<ListingForReview[] | null>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    fetchListingsForReview()
      .then(async (l) => {
        setItems(l);
        setUrls(await listingPhotoUrls(l.flatMap((x) => (x.photos ?? []).map((p) => p.path))));
      })
      .catch((e: Error) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  if (error) return <p role="alert" className="text-sm text-red-600">{error}</p>;
  if (!items) return <Loader2 className="mx-auto size-6 animate-spin text-ink-400" />;
  return (
    <>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs text-ink-500">Tolak gambar yang tidak berkaitan, mengelirukan, menunjukkan muka/nombor telefon orang lain, atau mengandungi iklan luar.</p>
        <Button variant="ghost" className="shrink-0 px-2 py-1 text-xs" onClick={load}>
          <RefreshCw className="size-3.5" /> Muat semula
        </Button>
      </div>
      {items.length === 0 ? (
        <EmptyState icon={Check} title="Tiada listing untuk disemak">Listing baru, perubahan dan gambar baru akan muncul di sini.</EmptyState>
      ) : (
        <ul className="space-y-3">{items.map((l) => <Card key={l.id} l={l} urls={urls} onDone={load} />)}</ul>
      )}
    </>
  );
}

function Card({ l, urls, onDone }: { l: ListingForReview; urls: Record<string, string>; onDone: () => void }) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [photos, setPhotos] = useState<ListingPhoto[]>(l.photos ?? []);
  const [error, setError] = useState<string | null>(null);
  const car = l.kind === 'car_rental';
  const d = l.details;
  const s = LISTING_STATUS[l.status];

  const act = async (fn: () => Promise<void>, reload = true) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      if (reload) onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal.');
    } finally {
      setBusy(false);
    }
  };
  const photo = (p: ListingPhoto, approve: boolean) =>
    act(async () => {
      await reviewListingPhoto(p.id, approve);
      setPhotos((x) => x.map((y) => (y.id === p.id ? { ...y, status: approve ? 'approved' : 'rejected' } : y)));
    }, false);

  const facts = car
    ? [d.brand && d.model ? `${d.brand} ${d.model}` : null, d.year, d.transmission === 'manual' ? 'Manual' : 'Auto', d.seats ? `${d.seats} tempat duduk` : null, FUELS.find((x) => x.id === d.fuel)?.label, l.service_radius_km ? `servis ${l.service_radius_km} km` : null, l.insurance_expires_on ? `insurans tamat ${l.insurance_expires_on}` : 'tiada maklumat insurans']
    : [HOMESTAY_TYPES.find((x) => x.id === d.type)?.label, d.bedrooms !== undefined ? `${d.bedrooms} bilik` : null, d.max_guests ? `${d.max_guests} tetamu` : null, (d.amenities ?? []).map((a) => AMENITIES.find((x) => x.id === a)?.label).filter(Boolean).join(', ') || null];

  return (
    <li className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-ink-200 dark:bg-ink-900 dark:ring-ink-800">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-bold">{l.title}</p>
          <p className="text-xs text-ink-500">{l.operator?.business_name} · {car ? 'Kereta sewa' : 'Homestay'}</p>
        </div>
        <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold', s.tone)}>{s.text}</span>
      </div>
      <p className="mt-2 text-sm">
        <strong>{rm(l.price)}</strong>/{car ? 'hari' : 'malam'}
        {l.weekend_price ? ` · hujung minggu ${rm(l.weekend_price)}` : ''}
        {l.deposit ? ` · deposit ${rm(l.deposit)}` : ''}
      </p>
      <p className="text-xs text-ink-600 dark:text-ink-300">{facts.filter(Boolean).join(' · ')}</p>
      {l.description && <p className="mt-1 text-xs italic text-ink-600 dark:text-ink-300">“{l.description}”</p>}
      {d.rules && <p className="mt-1 text-xs text-ink-500">Peraturan: {d.rules}</p>}
      <a className="mt-1 inline-flex items-center gap-1 text-xs text-sky-600" href={`https://www.google.com/maps/search/?api=1&query=${l.latitude},${l.longitude}`} target="_blank" rel="noreferrer">
        <MapPin className="size-3.5" /> {l.area_label} · lihat lokasi
      </a>
      <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {photos.map((p) => (
          <li key={p.id} className="overflow-hidden rounded-xl ring-1 ring-ink-200 dark:ring-ink-700">
            <div className="relative aspect-square bg-ink-100 dark:bg-ink-800">
              {urls[p.path] && <a href={urls[p.path]} target="_blank" rel="noreferrer"><img src={urls[p.path]} alt="" className="size-full object-cover" /></a>}
              <span className={cn('absolute left-1 top-1 rounded px-1 text-[10px] font-bold', PHOTO_STATUS[p.status].tone)}>{PHOTO_STATUS[p.status].text}</span>
            </div>
            {p.status === 'pending' && (
              <div className="grid grid-cols-2">
                <button type="button" disabled={busy} onClick={() => void photo(p, true)} className="flex items-center justify-center gap-1 py-1.5 text-xs font-semibold text-jade-700 dark:text-jade-400"><Check className="size-3.5" /> Lulus</button>
                <button type="button" disabled={busy} onClick={() => void photo(p, false)} className="flex items-center justify-center gap-1 py-1.5 text-xs font-semibold text-red-600"><X className="size-3.5" /> Tolak</button>
              </div>
            )}
          </li>
        ))}
      </ul>
      {l.status === 'pending' && (
        <>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={2} placeholder="Nota untuk operator (wajib jika Tolak)" aria-label="Nota untuk operator" className="mt-3 w-full resize-none rounded-xl bg-ink-100 px-3 py-2 text-sm dark:bg-ink-800" />
          <p className="mt-1 text-[11px] text-ink-500">Lulus listing juga meluluskan semua gambar yang masih menunggu. Tolak gambar yang tidak sesuai dahulu.</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Button disabled={busy} onClick={() => void act(() => reviewListing(l.id, true, note.trim() || undefined))}><Check className="size-4" /> Lulus & siar</Button>
            <Button variant="danger" disabled={busy} onClick={() => (note.trim() ? void act(() => reviewListing(l.id, false, note.trim())) : setError('Tulis sebab untuk operator dahulu.'))}><X className="size-4" /> Tolak</Button>
          </div>
        </>
      )}
      {error && <p role="alert" className="mt-2 text-xs text-red-600">{error}</p>}
    </li>
  );
}
