import { Car, Eye, Home, ImageOff, MessageCircle, Phone, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { cn } from '@/lib/cn';
import { LISTING_STATUS, rm } from '@/lib/listingLabels';
import { fetchMyListingStats, type ListingStats } from '@/services/marketService';
import { fetchMyListings, LISTING_LIMIT, listingPhotoUrls, type Listing } from '@/services/listingService';
import type { Operator } from '@/services/operatorService';
import { useT } from '@/lib/i18n';

/** "Listing saya": the operator's cars / homestay units with status, cover photo and price. */
export function MyListings({ operator }: { operator: Operator }) {
  const [t] = useT();
  const [items, setItems] = useState<Listing[] | null>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<Record<string, ListingStats>>({});
  const car = operator.kind === 'car_rental';
  const food = operator.kind === 'food';

  useEffect(() => {
    fetchMyListings(operator.id)
      .then(async (l) => {
        setItems(l);
        setUrls(await listingPhotoUrls(l.flatMap((x) => (x.photos?.[0] ? [x.photos[0].path] : []))));
      })
      .catch((e: Error) => setError(e.message));
    fetchMyListingStats().then(setStats, () => undefined);
  }, [operator.id]);

  const full = (items?.length ?? 0) >= LISTING_LIMIT;
  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-ink-200 dark:bg-ink-900 dark:ring-ink-800">
      <div className="mb-2 flex items-center justify-between">
        <p className="font-bold">{car ? t('Kereta saya', 'My cars') : food ? t('Kedai / cawangan saya', 'My shops / branches') : t('Unit homestay saya', 'My homestay units')} ({items?.length ?? 0}/{LISTING_LIMIT})</p>
        {!full && (
          <Link to="/business/listings/new" className="flex items-center gap-1 rounded-lg bg-jade-500 px-3 py-1.5 text-xs font-semibold text-white">
            <Plus className="size-3.5" /> {car ? t('Tambah kereta', 'Add car') : food ? t('Tambah kedai', 'Add shop') : t('Tambah unit', 'Add unit')}
          </Link>
        )}
      </div>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {items && items.length === 0 && (
        <p className="py-3 text-sm text-ink-500">{car ? t('Belum ada kereta. Tambah kereta pertama anda: maklumat, lokasi pangkalan dan gambar.', 'No cars yet. Add your first car: details, base location and photos.') : food ? t('Belum ada kedai. Tambah kedai anda: menu, waktu buka, lokasi dan gambar.', 'No shop yet. Add your shop: menu, opening hours, location and photos.') : t('Belum ada unit. Tambah homestay pertama anda: maklumat, lokasi dan gambar.', 'No units yet. Add your first homestay: details, location and photos.')}</p>
      )}
      {Object.keys(stats).length > 0 && <p className="mb-1 text-[11px] text-ink-500">{t('30 hari lepas:', 'Last 30 days:')} <Eye className="inline size-3" /> {t('paparan ·', 'views ·')} <MessageCircle className="inline size-3" /> WhatsApp · <Phone className="inline size-3" /> {t('panggilan', 'calls')}</p>}
      <ul className="space-y-2">
        {(items ?? []).map((l) => {
          const s = LISTING_STATUS[l.status];
          const cover = l.photos?.[0];
          const pendingPhotos = (l.photos ?? []).filter((p) => p.status === 'pending').length;
          return (
            <li key={l.id}>
              <Link to={`/business/listings/${l.id}`} className="flex items-center gap-3 rounded-xl p-2 hover:bg-ink-100 dark:hover:bg-ink-800">
                <span className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-lg bg-ink-100 text-ink-400 dark:bg-ink-800">
                  {cover && urls[cover.path] ? <img src={urls[cover.path]} alt="" className="size-full object-cover" /> : cover ? (car ? <Car className="size-6" /> : <Home className="size-6" />) : <ImageOff className="size-5" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{l.title}</span>
                  <span className="block text-xs text-ink-500">{food ? t(`± ${rm(l.price)} seorang`, `± ${rm(l.price)} per person`) : `${rm(l.price)}/${car ? t('hari', 'day') : t('malam', 'night')}`} · {l.area_label}</span>
                  {stats[l.id] && (l.status === 'live' || stats[l.id].views > 0) && (
                    <span className="mt-0.5 flex gap-2.5 text-[11px] text-ink-500" title={t('30 hari lepas', 'Last 30 days')}>
                      <span className="flex items-center gap-0.5"><Eye className="size-3" /> {stats[l.id].views}</span>
                      <span className="flex items-center gap-0.5"><MessageCircle className="size-3" /> {stats[l.id].whatsapp}</span>
                      <span className="flex items-center gap-0.5"><Phone className="size-3" /> {stats[l.id].calls}</span>
                    </span>
                  )}
                  {pendingPhotos > 0 && l.status === 'live' && <span className="block text-[11px] text-amber-600">{pendingPhotos} {t('gambar baru menunggu semakan', 'new photos waiting for review')}</span>}
                </span>
                <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold', s.tone)}>{t(s.text)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
