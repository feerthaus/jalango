import { Car, Home, MapPin, Utensils } from 'lucide-react';
import { isOpenNow } from '@/utils/openingHours';
import { Link } from 'react-router';
import { FOOD_TYPES, rm } from '@/lib/listingLabels';
import type { PublicListing } from '@/services/marketService';
import { formatDistance } from '@/utils/geo';
import { isListingInsured, TrustBadges } from './TrustBadges';

export function ListingCard({ l, distance }: { l: PublicListing; distance?: number | null }) {
  const car = l.kind === 'car_rental';
  const food = l.kind === 'food';
  const d = l.details;
  const open = food ? isOpenNow(d) : null;
  const facts = car
    ? [d.transmission === 'manual' ? 'Manual' : 'Auto', d.seats ? `${d.seats} tempat duduk` : null].filter(Boolean)
    : food
      ? [FOOD_TYPES.find((x) => x.id === d.food_type)?.label ?? null, open === true ? 'Buka sekarang' : open === false ? 'Tutup' : null].filter(Boolean)
      : [d.bedrooms ? `${d.bedrooms} bilik` : null, d.max_guests ? `${d.max_guests} tetamu` : null].filter(Boolean);
  return (
    <Link to={`/sewa/${l.id}`} className="block overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-ink-200 transition hover:ring-jade-500 dark:bg-ink-900 dark:ring-ink-800">
      <div className="relative aspect-[16/9] bg-ink-100 dark:bg-ink-800">
        {l.photoUrls[0] ? (
          <img src={l.photoUrls[0]} alt="" loading="lazy" className="size-full object-cover" />
        ) : (
          <span className="grid size-full place-items-center text-ink-400">{car ? <Car className="size-10" /> : food ? <Utensils className="size-10" /> : <Home className="size-10" />}</span>
        )}
        <span className="absolute bottom-2 left-2 rounded-full bg-ink-950/75 px-2.5 py-1 text-sm font-black text-white">
          {food ? <>± {rm(l.price)}<span className="text-xs font-semibold"> seorang</span></> : <>{rm(l.price)}<span className="text-xs font-semibold">/{car ? 'hari' : 'malam'}</span></>}
        </span>
      </div>
      <div className="space-y-1.5 p-3">
        <p className="truncate font-bold">{l.title}</p>
        <p className="flex items-center gap-1 text-xs text-ink-500">
          <MapPin className="size-3.5 shrink-0" />
          <span className="truncate">{l.area_label}{distance != null ? ` · ${formatDistance(distance)}` : ''}{facts.length ? ` · ${facts.join(' · ')}` : ''}</span>
        </p>
        <TrustBadges operator={l.operator} listingInsured={isListingInsured(l.insurance_expires_on)} compact />
      </div>
    </Link>
  );
}
