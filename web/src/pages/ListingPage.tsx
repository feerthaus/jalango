import { usePageMeta } from '@/hooks/usePageMeta';
import { ArrowLeft, Bath, Utensils, BedDouble, Car, ChevronLeft, ChevronRight, Clock, Fuel, Home, Info, MapPin, Navigation, Phone, Share2, Users } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { AvailabilityCalendar } from '@/components/business/AvailabilityCalendar';
import { isListingInsured, TrustBadges } from '@/components/market/TrustBadges';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import { useLocation } from '@/contexts/LocationContext';
import { useIsNavigating } from '@/contexts/RoutingContext';
import { useShowOnMap } from '@/hooks/useShowOnMap';
import { AMENITIES, DAYS, FOOD_SERVICES, FOOD_TYPES, FUELS, HALAL_LABEL, HOMESTAY_TYPES, rm } from '@/lib/listingLabels';
import { enquiryText, estimateTotal, foodEnquiryText, msisdn, overlapsBlocked, whatsappUrl } from '@/lib/rentalContact';
import { formatTime, isOpenNow } from '@/utils/openingHours';
import { fetchPublicListing, logListingEvent, type PublicListing } from '@/services/marketService';
import { useT } from '@/lib/i18n';

const fmt = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString('ms-MY', { day: 'numeric', month: 'short', timeZone: 'UTC' });

/** Public page for one car / homestay: photos, facts, availability and WhatsApp. */
export function ListingPage() {
  const [t] = useT();
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const navigating = useIsNavigating();
  const [l, setL] = useState<PublicListing | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  usePageMeta({ title: l ? l.title : t('Sewa & Makan', 'Rent & Food'), description: l ? `${l.title} · ${l.area_label}` : undefined, noindex: l === null });

  useEffect(() => {
    if (navigating) return;
    let alive = true;
    fetchPublicListing(id)
      .then((r) => {
        if (!alive) return;
        setL(r);
        if (r) logListingEvent(r.id, 'view');
      })
      .catch((e: Error) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [id, navigating]);

  return (
    <section className="pointer-events-auto absolute inset-x-0 top-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] flex flex-col bg-ink-50 md:inset-y-0 md:bottom-0 md:left-0 md:w-[480px] md:border-r md:border-ink-200 md:shadow-float dark:bg-ink-950 md:dark:border-ink-800">
      <header className="safe-top flex items-center gap-2 px-3 pb-2 pt-3">
        <button type="button" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/sewa'))} aria-label={t('Kembali', 'Back')} className="grid size-10 place-items-center rounded-full hover:bg-ink-200 dark:hover:bg-ink-800">
          <ArrowLeft className="size-5" />
        </button>
        <p className="min-w-0 flex-1 truncate font-bold">{l?.title ?? 'Sewa'}</p>
        {l && <ShareButton l={l} />}
      </header>
      <div className="flex-1 overflow-y-auto overscroll-contain pb-6">
        {navigating ? (
          <EmptyState icon={Car} title={t('Tidak dipaparkan semasa memandu', 'Not shown while driving')}>{t('Fokus pada jalan. Buka semula selepas anda berhenti.', 'Focus on the road. Open it again once you’ve stopped.')}</EmptyState>
        ) : error ? (
          <p role="alert" className="p-4 text-sm text-red-600">{error}</p>
        ) : l === undefined ? (
          <div className="grid place-items-center py-16"><Spinner label={t('Memuatkan', 'Loading')} /></div>
        ) : l === null ? (
          <EmptyState icon={Home} title={t('Sewaan tidak dijumpai', 'Rental not found')}>{t('Mungkin sudah tamat atau dijeda oleh pemilik.', 'It may have ended or been paused by the owner.')} <Link to="/sewa" className="font-semibold text-jade-600 underline">{t('Lihat sewaan lain', 'See other rentals')}</Link></EmptyState>
        ) : (
          l.kind === 'food' ? <FoodDetail l={l} /> : <Detail l={l} />
        )}
      </div>
    </section>
  );
}

function ShareButton({ l }: { l: PublicListing }) {
  const [t] = useT();
  const share = async () => {
    const url = `${window.location.origin}/sewa/${l.id}`;
    try {
      if (navigator.share) await navigator.share({ title: l.title, text: `${l.title} · ${rm(l.price)} (JalanGo)`, url });
      else await navigator.clipboard.writeText(url);
    } catch {
      /* cancelled */
    }
  };
  return (
    <button type="button" onClick={() => void share()} aria-label={t('Kongsi', 'Share')} className="grid size-10 place-items-center rounded-full hover:bg-ink-200 dark:hover:bg-ink-800">
      <Share2 className="size-5" />
    </button>
  );
}

function Photos({ urls, car }: { urls: string[]; car: boolean }) {
  const [t] = useT();
  const [i, setI] = useState(0);
  if (urls.length === 0)
    return <div className="grid aspect-[4/3] place-items-center bg-ink-100 text-ink-400 dark:bg-ink-800">{car ? <Car className="size-12" /> : <Home className="size-12" />}</div>;
  return (
    <div className="relative aspect-[4/3] bg-ink-900">
      <img src={urls[i]} alt={t(`Gambar ${i + 1} daripada ${urls.length}`, `Photo ${i + 1} of ${urls.length}`)} className="size-full object-cover" />
      {urls.length > 1 && (
        <>
          <button type="button" aria-label={t('Gambar sebelum', 'Previous photo')} onClick={() => setI((i - 1 + urls.length) % urls.length)} className="absolute left-2 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-white/85 text-ink-900">
            <ChevronLeft className="size-5" />
          </button>
          <button type="button" aria-label={t('Gambar seterusnya', 'Next photo')} onClick={() => setI((i + 1) % urls.length)} className="absolute right-2 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-white/85 text-ink-900">
            <ChevronRight className="size-5" />
          </button>
          <span className="absolute bottom-2 right-2 rounded-full bg-ink-950/70 px-2 py-0.5 text-xs font-semibold text-white">{i + 1}/{urls.length}</span>
        </>
      )}
    </div>
  );
}

function Detail({ l }: { l: PublicListing }) {
  const [t] = useT();
  const car = l.kind === 'car_rental';
  const kind: 'homestay' | 'car_rental' = car ? 'car_rental' : 'homestay';
  const d = l.details;
  const { fix } = useLocation();
  const showOnMap = useShowOnMap();
  const blocked = useMemo(() => new Set((l.blocks ?? []).map((b) => b.day)), [l.blocks]);
  const [from, setFrom] = useState<string | null>(null);
  const [to, setTo] = useState<string | null>(null);
  const [sendLoc, setSendLoc] = useState(true);

  const onPick = (day: string) => {
    if (!from || to || day <= from) {
      setFrom(day);
      setTo(null);
    } else setTo(day);
  };
  const clash = from && to ? overlapsBlocked(from, to, blocked, kind) : false;
  const est = from && to && !clash ? estimateTotal(from, to, l.price, l.weekend_price, kind) : null;
  const pageUrl = `${window.location.origin}/sewa/${l.id}`;
  const pickup = car && sendLoc && fix ? fix.coordinates : null;
  const wa = whatsappUrl(l.operator.phone, enquiryText({ kind, title: l.title, url: pageUrl, from, to, pickup }));

  const facts: { icon: typeof Car; text: string }[] = car
    ? [
        ...(d.brand || d.model ? [{ icon: Car, text: [d.brand, d.model, d.year].filter(Boolean).join(' ') }] : []),
        { icon: Car, text: d.transmission === 'manual' ? 'Manual' : t('Automatik', 'Automatic') },
        ...(d.seats ? [{ icon: Users, text: t(`${d.seats} tempat duduk`, `${d.seats} seats`) }] : []),
        ...(d.fuel ? [{ icon: Fuel, text: (() => { const f = FUELS.find((x) => x.id === d.fuel); return f ? t(f.label) : String(d.fuel); })() }] : []),
      ]
    : [
        ...(d.type ? [{ icon: Home, text: (() => { const h = HOMESTAY_TYPES.find((x) => x.id === d.type); return h ? t(h.label) : String(d.type); })() }] : []),
        ...(d.bedrooms ? [{ icon: BedDouble, text: t(`${d.bedrooms} bilik tidur`, `${d.bedrooms} bedrooms`) }] : []),
        ...(d.bathrooms ? [{ icon: Bath, text: t(`${d.bathrooms} bilik air`, `${d.bathrooms} bathrooms`) }] : []),
        ...(d.max_guests ? [{ icon: Users, text: t(`Maks ${d.max_guests} tetamu`, `Up to ${d.max_guests} guests`) }] : []),
        ...(d.check_in || d.check_out ? [{ icon: Clock, text: t(`Masuk ${d.check_in ?? '-'} · Keluar ${d.check_out ?? '-'}`, `Check-in ${d.check_in ?? '-'} · Check-out ${d.check_out ?? '-'}`) }] : []),
      ];
  const amenities = AMENITIES.filter((a) => d.amenities?.includes(a.id));

  return (
    <>
      <Photos urls={l.photoUrls} car={car} />
      <div className="space-y-4 p-4">
        <div>
          <h1 className="text-xl font-black leading-tight">{l.title}</h1>
          <p className="mt-1 flex items-center gap-1 text-sm text-ink-500"><MapPin className="size-4" /> {l.area_label}</p>
          <p className="mt-2 text-lg font-black">
            {rm(l.price)}<span className="text-sm font-semibold text-ink-500">/{car ? t('hari', 'day') : t('malam', 'night')}</span>
            {l.weekend_price && <span className="ml-2 text-sm font-semibold text-ink-500">{t('· Hujung minggu', '· Weekend')} {rm(l.weekend_price)}</span>}
          </p>
          {l.deposit ? <p className="text-sm text-ink-500">Deposit {rm(l.deposit)} {t('(dipulangkan)', '(refundable)')}</p> : null}
        </div>

        <ul className="grid grid-cols-2 gap-2 text-sm">
          {facts.map((f) => (
            <li key={f.text} className="flex items-center gap-2 rounded-xl bg-white p-2.5 ring-1 ring-ink-200 dark:bg-ink-900 dark:ring-ink-800">
              <f.icon className="size-4 shrink-0 text-jade-600" /> {f.text}
            </li>
          ))}
        </ul>
        {amenities.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {amenities.map((a) => <span key={a.id} className="rounded-full bg-ink-200/70 px-2.5 py-1 text-xs font-semibold dark:bg-ink-800">{t(a.label)}</span>)}
          </div>
        )}
        {l.description && <p className="whitespace-pre-line text-[15px] leading-relaxed">{l.description}</p>}
        {!car && d.rules && (
          <div>
            <p className="text-sm font-bold">{t('Peraturan rumah', 'House rules')}</p>
            <p className="whitespace-pre-line text-sm text-ink-600 dark:text-ink-300">{d.rules}</p>
          </div>
        )}
        {car && l.service_radius_km && (
          <p className="flex items-start gap-2 rounded-xl bg-sky-500/10 p-3 text-sm text-sky-900 dark:text-sky-100">
            <Info className="mt-0.5 size-4 shrink-0" /> {t('Boleh hantar & ambil kereta di lokasi anda dalam lingkungan', 'Can deliver & collect the car at your location within')} {l.service_radius_km} {t('km dari', 'km of')} {l.area_label}.
          </p>
        )}

        <div className="rounded-2xl bg-white p-4 ring-1 ring-ink-200 dark:bg-ink-900 dark:ring-ink-800">
          <p className="mb-2 font-bold">{car ? t('Pilih tarikh ambil & pulang', 'Choose pickup & return dates') : t('Pilih tarikh masuk & keluar', 'Choose check-in & check-out dates')}</p>
          <AvailabilityCalendar blocked={blocked} pick={{ from, to, onPick }} />
          {from && (
            <p className="mt-2 text-sm" aria-live="polite">
              {fmt(from)}{to ? ` → ${fmt(to)}` : t(' → pilih tarikh akhir', ' → choose an end date')}
              {clash && <span className="block font-semibold text-red-600">{t('Ada tarikh penuh dalam julat ini. Pilih tarikh lain.', 'Some dates in this range are full. Choose other dates.')}</span>}
              {est && <span className="block font-semibold">{t('Anggaran:', 'Estimate:')} {rm(est.total)} {t('untuk', 'for')} {est.units} {car ? t('hari', 'day') : t('malam', 'night')}{l.deposit ? t(` + deposit ${rm(l.deposit)}`, ` + deposit ${rm(l.deposit)}`) : ''}</span>}
            </p>
          )}
          <p className="mt-1 text-[11px] text-ink-500">{t('Kekosongan dikemas kini oleh pemilik. Sahkan dengan pemilik sebelum bayar.', 'Availability is updated by the owner. Confirm with the owner before paying.')}</p>
        </div>

        <div className="rounded-2xl bg-white p-4 ring-1 ring-ink-200 dark:bg-ink-900 dark:ring-ink-800">
          <p className="font-bold">{l.operator.business_name}</p>
          <p className="text-sm text-ink-500">{l.operator.town}, {l.operator.state}</p>
          <div className="mt-2"><TrustBadges operator={l.operator} listingInsured={isListingInsured(l.insurance_expires_on)} /></div>
          {car && !l.operator.apad_licensed && (
            <p className="mt-2 text-xs text-ink-500">{t('Operator ini tiada lesen APAD yang disahkan oleh JalanGo. Pastikan perjanjian sewa dan insurans jelas sebelum memandu.', 'This operator has no APAD licence verified by JalanGo. Make sure the rental agreement and insurance are clear before you drive.')}</p>
          )}
        </div>

        {car && (
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-0.5 size-4 accent-jade-500" checked={sendLoc} onChange={(e) => setSendLoc(e.target.checked)} />
            <span>{t('Hantar lokasi saya dalam WhatsApp untuk ambil/hantar kereta', 'Send my location on WhatsApp for car pickup/drop-off')}{sendLoc && !fix ? t(' (hidupkan lokasi dahulu)', ' (turn on location first)') : ''}</span>
          </label>
        )}

        <div className="grid grid-cols-[1fr_auto_auto] gap-2">
          <a href={wa} target="_blank" rel="noopener noreferrer" onClick={() => logListingEvent(l.id, 'whatsapp')} className="flex items-center justify-center gap-2 rounded-xl bg-[#25D366] py-3.5 font-bold text-ink-950">
            <WhatsAppIcon /> WhatsApp
          </a>
          <a href={`tel:+${msisdn(l.operator.phone)}`} onClick={() => logListingEvent(l.id, 'call')} aria-label={t('Telefon', 'Call')} className="grid w-14 place-items-center rounded-xl bg-white ring-1 ring-ink-200 dark:bg-ink-900 dark:ring-ink-800">
            <Phone className="size-5" />
          </a>
          <button
            type="button"
            aria-label={t('Tunjuk arah', 'Directions')}
            onClick={() => {
              logListingEvent(l.id, 'directions');
              showOnMap({ id: `listing:${l.id}`, name: l.title, address: l.area_label, coordinates: { lat: l.latitude, lng: l.longitude }, kind: 'poi', source: 'link' }, { remember: false });
            }}
            className="grid w-14 place-items-center rounded-xl bg-white ring-1 ring-ink-200 dark:bg-ink-900 dark:ring-ink-800"
          >
            <Navigation className="size-5" />
          </button>
        </div>
        <p className="text-center text-[11px] text-ink-500">
          {t('Tempahan dan bayaran terus dengan pemilik. JalanGo menyemak dokumen operator tetapi bukan pihak dalam perjanjian sewa.', 'Bookings and payment are directly with the owner. JalanGo checks operator documents but is not a party to the rental agreement.')}
        </p>
      </div>
    </>
  );
}

/** Restaurant / warung / stall: open now, hours, services, halal, menu, WhatsApp. */
function FoodDetail({ l }: { l: PublicListing }) {
  const [t] = useT();
  const d = l.details;
  const showOnMap = useShowOnMap();
  const open = isOpenNow(d);
  const closed = (d.closed_days ?? []).map((i) => t(DAYS[i]));
  // "Halal JAKIM" only when an admin checked the certificate; other claims never use the word halal
  const halal = d.halal === 'jakim' ? (l.operator.halal_verified ? t(HALAL_LABEL.jakim) : null) : d.halal ? t(HALAL_LABEL[d.halal]) : null;
  const services = FOOD_SERVICES.filter((x) => d.services?.includes(x.id)).map((x) => t(x.label));
  const wa = whatsappUrl(l.operator.phone, foodEnquiryText(l.title, `${window.location.origin}/sewa/${l.id}`));

  return (
    <>
      <Photos urls={l.photoUrls} car={false} />
      <div className="space-y-4 p-4">
        <div>
          <h1 className="text-xl font-black leading-tight">{l.title}</h1>
          <p className="mt-1 flex items-center gap-1 text-sm text-ink-500"><MapPin className="size-4" /> {l.area_label}</p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-sm">
            {open !== null && (
              <span className={open ? 'rounded-full bg-jade-500/15 px-2.5 py-0.5 font-bold text-jade-700 dark:text-jade-300' : 'rounded-full bg-red-500/10 px-2.5 py-0.5 font-bold text-red-700 dark:text-red-300'}>
                {open ? t('Buka sekarang', 'Open now') : t('Tutup sekarang', 'Closed now')}
              </span>
            )}
            {halal && <span className="rounded-full bg-ink-200/70 px-2.5 py-0.5 font-semibold dark:bg-ink-800">{halal}</span>}
            <span className="font-semibold">± {rm(l.price)} {t('seorang', 'per person')}</span>
          </div>
        </div>

        <ul className="grid grid-cols-2 gap-2 text-sm">
          {d.food_type && <li className="flex items-center gap-2 rounded-xl bg-white p-2.5 ring-1 ring-ink-200 dark:bg-ink-900 dark:ring-ink-800"><Utensils className="size-4 shrink-0 text-jade-600" /> {(() => { const ft = FOOD_TYPES.find((x) => x.id === d.food_type); return ft ? t(ft.label) : null; })()}</li>}
          {d.opens && d.closes && <li className="flex items-center gap-2 rounded-xl bg-white p-2.5 ring-1 ring-ink-200 dark:bg-ink-900 dark:ring-ink-800"><Clock className="size-4 shrink-0 text-jade-600" /> {d.opens === d.closes ? t('Buka 24 jam', 'Open 24 hours') : `${formatTime(d.opens)} – ${formatTime(d.closes)}`}</li>}
          {closed.length > 0 && <li className="col-span-2 rounded-xl bg-white p-2.5 ring-1 ring-ink-200 dark:bg-ink-900 dark:ring-ink-800">{t('Cuti:', 'Closed:')} {closed.join(', ')}</li>}
        </ul>
        {services.length > 0 && (
          <div className="flex flex-wrap gap-1.5">{services.map((x) => <span key={x} className="rounded-full bg-ink-200/70 px-2.5 py-1 text-xs font-semibold dark:bg-ink-800">{x}</span>)}</div>
        )}
        {l.description && <p className="whitespace-pre-line text-[15px] leading-relaxed">{l.description}</p>}

        {(d.menu ?? []).length > 0 && (
          <div className="rounded-2xl bg-white p-4 ring-1 ring-ink-200 dark:bg-ink-900 dark:ring-ink-800">
            <p className="mb-2 font-bold">Menu</p>
            <ul className="divide-y divide-ink-100 dark:divide-ink-800">
              {(d.menu ?? []).map((m, i) => (
                <li key={i} className="flex justify-between gap-3 py-1.5 text-sm">
                  <span>{m.name}</span>
                  {m.price != null && <span className="shrink-0 font-semibold tabular-nums">{rm(m.price)}</span>}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[11px] text-ink-500">{t('Harga oleh peniaga dan mungkin berubah.', 'Prices are set by the seller and may change.')}</p>
          </div>
        )}

        <div className="rounded-2xl bg-white p-4 ring-1 ring-ink-200 dark:bg-ink-900 dark:ring-ink-800">
          <p className="font-bold">{l.operator.business_name}</p>
          <p className="text-sm text-ink-500">{l.operator.town}, {l.operator.state}</p>
          <div className="mt-2"><TrustBadges operator={l.operator} /></div>
        </div>

        <div className="grid grid-cols-[1fr_auto_auto] gap-2">
          <a href={wa} target="_blank" rel="noopener noreferrer" onClick={() => logListingEvent(l.id, 'whatsapp')} className="flex items-center justify-center gap-2 rounded-xl bg-[#25D366] py-3.5 font-bold text-ink-950">
            <WhatsAppIcon /> WhatsApp
          </a>
          <a href={`tel:+${msisdn(l.operator.phone)}`} onClick={() => logListingEvent(l.id, 'call')} aria-label={t('Telefon', 'Call')} className="grid w-14 place-items-center rounded-xl bg-white ring-1 ring-ink-200 dark:bg-ink-900 dark:ring-ink-800">
            <Phone className="size-5" />
          </a>
          <button
            type="button"
            aria-label={t('Tunjuk arah', 'Directions')}
            onClick={() => {
              logListingEvent(l.id, 'directions');
              showOnMap({ id: `listing:${l.id}`, name: l.title, address: l.area_label, coordinates: { lat: l.latitude, lng: l.longitude }, kind: 'poi', source: 'link' }, { remember: false });
            }}
            className="grid w-14 place-items-center rounded-xl bg-white ring-1 ring-ink-200 dark:bg-ink-900 dark:ring-ink-800"
          >
            <Navigation className="size-5" />
          </button>
        </div>
        <p className="text-center text-[11px] text-ink-500">{t('Tempahan dan bayaran terus dengan peniaga. JalanGo menyemak IC dan premis peniaga.', 'Orders and payment are directly with the seller. JalanGo checks the seller’s IC and premises.')}</p>
      </div>
    </>
  );
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="currentColor" aria-hidden>
      <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 11.9 11.9 0 0 0 4.6 4c1.7.7 2.3.8 3.2.7.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3Z" />
    </svg>
  );
}
