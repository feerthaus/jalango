import { ArrowLeft, Camera, CheckCircle2, Loader2, Pause, Play, Send, Star, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { AvailabilityCalendar } from '@/components/business/AvailabilityCalendar';
import { LocationPicker } from '@/components/business/LocationPicker';
import { Button } from '@/components/ui/Button';
import { PagePanel } from '@/components/ui/PagePanel';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/cn';
import { AMENITIES, DAYS_MS, FOOD_SERVICES, FOOD_TYPES, FUELS, HOMESTAY_TYPES, LISTING_STATUS, PHOTO_STATUS } from '@/lib/listingLabels';
import {
  deleteListing,
  deleteListingPhoto,
  fetchMyListings,
  listingPhotoUrls,
  makeCover,
  MENU_LIMIT,
  PHOTO_LIMIT,
  saveListing,
  setBlocked,
  uploadListingPhoto,
  type CarDetails,
  type FoodDetails,
  type FoodType,
  type HalalClaim,
  type HomestayDetails,
  type MenuItem,
  type Listing,
  type ListingInput,
  type ListingPhoto,
} from '@/services/listingService';
import { fetchMyOperator, type Operator } from '@/services/operatorService';
import type { Coordinates } from '@/types';

const input = 'mt-1 w-full rounded-xl bg-ink-100 px-3 py-2.5 text-base font-normal outline-none ring-jade-500 focus:ring-2 dark:bg-ink-800';
const label = 'block text-sm font-semibold';
type Form = Omit<ListingInput, 'latitude' | 'longitude' | 'price'> & { price: string; weekend: string; depositText: string; at: Coordinates | null };

/** Create / edit one listing: a rental car or a homestay unit. */
export function ListingEditorPage() {
  const { id = 'new' } = useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [operator, setOperator] = useState<Operator | null>(null);
  const [listing, setListing] = useState<Listing | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      try {
        const { operator: op } = await fetchMyOperator(user.id);
        setOperator(op);
        if (op && id !== 'new') setListing((await fetchMyListings(op.id)).find((l) => l.id === id) ?? null);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Gagal memuat.');
      } finally {
        setLoaded(true);
      }
    })();
  }, [user, id]);

  const back = (
    <Link to="/business" className="mb-2 inline-flex items-center gap-1 text-sm font-semibold text-jade-700 dark:text-jade-400">
      <ArrowLeft className="size-4" /> Bisnes saya
    </Link>
  );
  if (loading || (user && !loaded)) return <PagePanel title="Listing"><Loader2 className="mx-auto mt-6 size-6 animate-spin text-ink-400" /></PagePanel>;
  if (!user || !operator || operator.status !== 'approved')
    return (
      <PagePanel title="Listing">
        {back}
        <p className="text-sm text-ink-500">Listing hanya boleh dibuat selepas bisnes anda diluluskan.</p>
      </PagePanel>
    );
  if (id !== 'new' && !listing) return <PagePanel title="Listing">{back}<p className="text-sm text-ink-500">{error ?? 'Listing tidak dijumpai.'}</p></PagePanel>;

  return (
    <PagePanel title={listing ? listing.title : operator.kind === 'car_rental' ? 'Tambah kereta' : operator.kind === 'food' ? 'Tambah kedai makan' : 'Tambah unit homestay'}>
      {back}
      <Editor key={listing?.id ?? 'new'} userId={user.id} operator={operator} listing={listing} onSaved={(l) => { setListing(l); if (id === 'new') navigate(`/business/listings/${l.id}`, { replace: true }); }} onDeleted={() => navigate('/business')} />
    </PagePanel>
  );
}

function Editor({ userId, operator, listing, onSaved, onDeleted }: { userId: string; operator: Operator; listing: Listing | null; onSaved: (l: Listing) => void; onDeleted: () => void }) {
  const car = operator.kind === 'car_rental';
  const food = operator.kind === 'food';
  const [f, setF] = useState<Form>(() => ({
    title: listing?.title ?? '',
    description: listing?.description ?? '',
    price: listing ? String(listing.price) : '',
    weekend: listing?.weekend_price ? String(listing.weekend_price) : '',
    depositText: listing?.deposit ? String(listing.deposit) : '',
    weekend_price: null,
    deposit: null,
    area_label: listing?.area_label ?? operator.town,
    service_radius_km: listing?.service_radius_km ?? (car ? 30 : null),
    details:
      listing?.details ??
      (car
        ? { transmission: 'auto', seats: 5, fuel: 'petrol' }
        : food
          ? { food_type: 'warung', opens: '07:00', closes: '14:00', closed_days: [], halal: null, services: ['dine_in', 'takeaway'], menu: [] }
          : { type: 'house', amenities: [] }),
    insurance_expires_on: listing?.insurance_expires_on ?? null,
    at: listing ? { lat: listing.latitude, lng: listing.longitude } : null,
  }));
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const d = f.details as CarDetails & HomestayDetails & FoodDetails;
  const set = <K extends keyof Form>(k: K, v: Form[K]) => {
    setF((x) => ({ ...x, [k]: v }));
    setSaved(false);
  };
  const setD = (patch: Partial<CarDetails & HomestayDetails & FoodDetails>) => set('details', { ...f.details, ...patch });

  const save = async (status: 'draft' | 'pending' | 'live' | 'paused') => {
    setError(null);
    if (f.title.trim().length < 3) return setError('Tajuk sekurang-kurangnya 3 aksara.');
    const price = Number(f.price);
    if (!(price >= 1)) return setError(car ? 'Masukkan harga sehari.' : food ? 'Masukkan anggaran harga makan seorang.' : 'Masukkan harga semalam.');
    if (food && (d.menu ?? []).some((m) => !m.name.trim())) return setError('Isi nama setiap hidangan dalam menu, atau buang baris kosong.');
    if (!f.at) return setError('Tetapkan lokasi di peta.');
    setBusy(status);
    try {
      const body: ListingInput = {
        title: f.title,
        description: f.description?.trim() || null,
        price,
        weekend_price: !food && f.weekend ? Number(f.weekend) : null,
        deposit: !food && f.depositText ? Number(f.depositText) : null,
        latitude: f.at.lat,
        longitude: f.at.lng,
        area_label: f.area_label.trim() || operator.town,
        service_radius_km: car ? Number(f.service_radius_km) || 30 : null,
        details: f.details,
        insurance_expires_on: car ? f.insurance_expires_on || null : null,
      };
      onSaved(await saveListing(operator.id, userId, body, status, listing?.id));
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Tidak dapat simpan.');
    } finally {
      setBusy(null);
    }
  };

  const s = listing ? LISTING_STATUS[listing.status] : null;
  return (
    <div className="space-y-3">
      {listing && s && (
        <div className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-ink-200 dark:bg-ink-900 dark:ring-ink-800">
          <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', s.tone)}>{s.text}</span>
          {listing.status === 'pending' && <p className="mt-1 text-xs text-ink-500">Admin JalanGo akan menyemak maklumat dan gambar sebelum disiarkan.</p>}
          {listing.status === 'rejected' && listing.review_note && <p className="mt-1 text-sm"><strong>Nota admin:</strong> {listing.review_note}</p>}
        </div>
      )}

      <section className="space-y-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-ink-200 dark:bg-ink-900 dark:ring-ink-800">
        <p className="font-bold">Maklumat</p>
        <label className={label}>Tajuk<input className={input} value={f.title} maxLength={80} onChange={(e) => set('title', e.target.value)} placeholder={car ? 'cth. Perodua Myvi 1.5 AV 2022' : food ? 'cth. Warung Mak Teh Nasi Kerabu' : 'cth. Homestay Kayu 3 Bilik dekat Pantai'} /></label>
        {car ? (
          <>
            <div className="grid grid-cols-2 gap-2">
              <label className={label}>Jenama<input className={input} value={d.brand ?? ''} maxLength={30} onChange={(e) => setD({ brand: e.target.value })} placeholder="Perodua" /></label>
              <label className={label}>Model<input className={input} value={d.model ?? ''} maxLength={40} onChange={(e) => setD({ model: e.target.value })} placeholder="Myvi" /></label>
              <label className={label}>Tahun<input className={input} type="number" inputMode="numeric" min={1990} max={2030} value={d.year ?? ''} onChange={(e) => setD({ year: e.target.value ? Number(e.target.value) : undefined })} /></label>
              <label className={label}>Tempat duduk<input className={input} type="number" inputMode="numeric" min={2} max={15} value={d.seats ?? ''} onChange={(e) => setD({ seats: e.target.value ? Number(e.target.value) : undefined })} /></label>
              <label className={label}>Transmisi
                <select className={input} value={d.transmission ?? 'auto'} onChange={(e) => setD({ transmission: e.target.value as 'auto' | 'manual' })}>
                  <option value="auto">Auto</option>
                  <option value="manual">Manual</option>
                </select>
              </label>
              <label className={label}>Bahan api
                <select className={input} value={d.fuel ?? 'petrol'} onChange={(e) => setD({ fuel: e.target.value as CarDetails['fuel'] })}>
                  {FUELS.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
                </select>
              </label>
            </div>
            <label className={label}>Insurans kereta ini tamat (jika ada)<input className={input} type="date" value={f.insurance_expires_on ?? ''} onChange={(e) => set('insurance_expires_on', e.target.value || null)} /></label>
          </>
        ) : food ? (
          <FoodFields d={d} setD={setD} halalVerified={Boolean(operator.halal_verified_at)} />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2">
              <label className={label}>Jenis
                <select className={input} value={d.type ?? 'house'} onChange={(e) => setD({ type: e.target.value as HomestayDetails['type'] })}>
                  {HOMESTAY_TYPES.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
                </select>
              </label>
              <label className={label}>Tetamu maksimum<input className={input} type="number" inputMode="numeric" min={1} max={50} value={d.max_guests ?? ''} onChange={(e) => setD({ max_guests: e.target.value ? Number(e.target.value) : undefined })} /></label>
              <label className={label}>Bilik tidur<input className={input} type="number" inputMode="numeric" min={0} max={20} value={d.bedrooms ?? ''} onChange={(e) => setD({ bedrooms: e.target.value ? Number(e.target.value) : undefined })} /></label>
              <label className={label}>Bilik air<input className={input} type="number" inputMode="numeric" min={0} max={20} value={d.bathrooms ?? ''} onChange={(e) => setD({ bathrooms: e.target.value ? Number(e.target.value) : undefined })} /></label>
              <label className={label}>Daftar masuk<input className={input} type="time" value={d.check_in ?? '14:00'} onChange={(e) => setD({ check_in: e.target.value })} /></label>
              <label className={label}>Daftar keluar<input className={input} type="time" value={d.check_out ?? '12:00'} onChange={(e) => setD({ check_out: e.target.value })} /></label>
            </div>
            <fieldset>
              <legend className={label}>Kemudahan</legend>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {AMENITIES.map((a) => {
                  const on = (d.amenities ?? []).includes(a.id);
                  return (
                    <button key={a.id} type="button" aria-pressed={on} onClick={() => setD({ amenities: on ? (d.amenities ?? []).filter((x) => x !== a.id) : [...(d.amenities ?? []), a.id] })} className={cn('rounded-full px-3 py-1.5 text-xs font-semibold', on ? 'bg-jade-500 text-white' : 'bg-ink-100 dark:bg-ink-800')}>
                      {a.label}
                    </button>
                  );
                })}
              </div>
            </fieldset>
            <label className={label}>Peraturan rumah (pilihan)<textarea className={cn(input, 'resize-none')} rows={2} maxLength={300} value={d.rules ?? ''} onChange={(e) => setD({ rules: e.target.value })} placeholder="cth. Tiada merokok, tiada haiwan peliharaan" /></label>
          </>
        )}
        {food ? (
          <label className={label}>Anggaran harga makan seorang (RM)<span className="block text-xs font-normal text-ink-500">Dipaparkan sebagai "± RM… seorang".</span><input className={input} type="number" inputMode="decimal" min={1} value={f.price} onChange={(e) => set('price', e.target.value)} placeholder="cth. 10" /></label>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            <label className={label}>{car ? 'Harga/hari (RM)' : 'Harga/malam (RM)'}<input className={input} type="number" inputMode="decimal" min={1} value={f.price} onChange={(e) => set('price', e.target.value)} /></label>
            <label className={label}>Hujung minggu<input className={input} type="number" inputMode="decimal" min={1} value={f.weekend} onChange={(e) => set('weekend', e.target.value)} placeholder="sama" /></label>
            <label className={label}>Deposit<input className={input} type="number" inputMode="decimal" min={0} value={f.depositText} onChange={(e) => set('depositText', e.target.value)} /></label>
          </div>
        )}
        <label className={label}>Penerangan (pilihan)<textarea className={cn(input, 'resize-none')} rows={3} maxLength={1000} value={f.description ?? ''} onChange={(e) => set('description', e.target.value)} /></label>
      </section>

      <section className="space-y-2 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-ink-200 dark:bg-ink-900 dark:ring-ink-800">
        <p className="font-bold">{car ? 'Lokasi pangkalan kereta' : food ? 'Lokasi kedai / gerai' : 'Lokasi homestay'}</p>
        <p className="text-xs text-ink-500">{car ? 'Penyewa akan menghantar lokasi ambil/hantar mereka kepada anda melalui WhatsApp. Lokasi ini untuk carian "berdekatan".' : food ? 'Letak pin tepat di kedai atau gerai. Pemandu akan nampak kedai anda bila laluan mereka melaluinya.' : 'Lokasi tepat homestay, dipaparkan kepada pengguna dengan butang Navigasi.'}</p>
        <LocationPicker value={f.at} onChange={(c, area) => { set('at', c); if (area) setF((x) => ({ ...x, at: c, area_label: area })); }} />
        <label className={label}>Nama kawasan<input className={input} value={f.area_label} maxLength={80} onChange={(e) => set('area_label', e.target.value)} placeholder="cth. Kota Bharu, Kelantan" /></label>
        {car && (
          <label className={label}>Kawasan servis (km dari pangkalan)<input className={input} type="number" inputMode="numeric" min={1} max={300} value={f.service_radius_km ?? 30} onChange={(e) => set('service_radius_km', Number(e.target.value))} /></label>
        )}
      </section>

      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" disabled={Boolean(busy)} onClick={() => void save('draft')}>
          {busy === 'draft' && <Loader2 className="size-4 animate-spin" />} Simpan draf
        </Button>
        <Button disabled={Boolean(busy)} onClick={() => void save(listing?.status === 'live' || listing?.status === 'paused' ? (listing.status as 'live' | 'paused') : 'pending')}>
          {busy && busy !== 'draft' ? <Loader2 className="size-4 animate-spin" /> : saved ? <CheckCircle2 className="size-4" /> : <Send className="size-4" />} {listing && (listing.status === 'live' || listing.status === 'paused') ? 'Simpan perubahan' : 'Hantar untuk semakan'}
        </Button>
      </div>
      {listing && (listing.status === 'live' || listing.status === 'paused') && <p className="text-xs text-ink-500">Perubahan maklumat akan dihantar untuk semakan semula sebelum dipaparkan.</p>}

      {listing ? (
        <>
          <Photos userId={userId} listing={listing} onChange={(photos) => onSaved({ ...listing, photos })} />
          {!food && (
            <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-ink-200 dark:bg-ink-900 dark:ring-ink-800">
              <p className="mb-2 font-bold">Kalendar kekosongan</p>
              <Calendar listing={listing} onChange={(blocks) => onSaved({ ...listing, blocks })} />
            </section>
          )}
          <div className="grid grid-cols-2 gap-2">
            {listing.status === 'live' && (
              <Button variant="secondary" onClick={() => void save('paused')}><Pause className="size-4" /> Jeda listing</Button>
            )}
            {listing.status === 'paused' && (
              <Button variant="secondary" onClick={() => void save('live')}><Play className="size-4" /> Siar semula</Button>
            )}
            <Button
              variant="danger"
              className={listing.status === 'live' || listing.status === 'paused' ? '' : 'col-span-2'}
              onClick={async () => {
                if (!window.confirm('Padam listing ini? Gambar juga akan dipadam.')) return;
                try {
                  await deleteListing(listing);
                  onDeleted();
                } catch (e) {
                  setError(e instanceof Error ? e.message : 'Tidak dapat padam.');
                }
              }}
            >
              <Trash2 className="size-4" /> Padam
            </Button>
          </div>
        </>
      ) : (
        <p className="text-center text-xs text-ink-500">Simpan dahulu, kemudian tambah gambar dan kalendar.</p>
      )}
    </div>
  );
}

function Photos({ userId, listing, onChange }: { userId: string; listing: Listing; onChange: (p: ListingPhoto[]) => void }) {
  const photos = useMemo(() => listing.photos ?? [], [listing.photos]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const limit = PHOTO_LIMIT[listing.kind];
  const key = photos.map((p) => p.path).join('|');
  useEffect(() => {
    if (key) void listingPhotoUrls(key.split('|')).then(setUrls);
  }, [key]);

  const add = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    setError(null);
    let list = photos;
    try {
      for (const file of Array.from(files).slice(0, limit - list.length)) {
        const p = await uploadListingPhoto(userId, listing.id, file, list.length);
        list = [...list, p];
        onChange(list);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Muat naik gagal.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-ink-200 dark:bg-ink-900 dark:ring-ink-800">
      <div className="mb-2 flex items-center justify-between">
        <p className="font-bold">Gambar ({photos.length}/{limit})</p>
        {photos.length < limit && (
          <label className={cn('flex cursor-pointer items-center gap-1 rounded-lg bg-jade-500 px-3 py-1.5 text-xs font-semibold text-white', busy && 'pointer-events-none opacity-60')}>
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Camera className="size-3.5" />} Tambah gambar
            <input type="file" accept="image/*" multiple className="sr-only" aria-label="Tambah gambar" onChange={(e) => void add(e.target.files)} />
          </label>
        )}
      </div>
      <p className="mb-2 text-xs text-ink-500">Setiap gambar disemak admin sebelum dipaparkan. Gambar pertama ialah gambar utama.</p>
      {error && <p role="alert" className="mb-2 text-sm text-red-600">{error}</p>}
      <ul className="grid grid-cols-3 gap-2">
        {photos.map((p, i) => (
          <li key={p.id} className="relative aspect-square overflow-hidden rounded-xl bg-ink-100 dark:bg-ink-800">
            {urls[p.path] && <img src={urls[p.path]} alt="" className="size-full object-cover" />}
            <span className={cn('absolute left-1 top-1 rounded px-1 text-[10px] font-bold', PHOTO_STATUS[p.status].tone)}>{i === 0 ? '★ ' : ''}{PHOTO_STATUS[p.status].text}</span>
            <div className="absolute inset-x-1 bottom-1 flex justify-between">
              {i > 0 ? (
                <button type="button" aria-label="Jadikan gambar utama" onClick={async () => onChange(await makeCover(photos, p.id))} className="grid size-7 place-items-center rounded-full bg-ink-950/70 text-white"><Star className="size-3.5" /></button>
              ) : <span />}
              <button type="button" aria-label="Padam gambar" onClick={async () => { try { await deleteListingPhoto(p); onChange(photos.filter((x) => x.id !== p.id)); } catch (e) { setError(e instanceof Error ? e.message : 'Gagal.'); } }} className="grid size-7 place-items-center rounded-full bg-ink-950/70 text-white"><Trash2 className="size-3.5" /></button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Calendar({ listing, onChange }: { listing: Listing; onChange: (b: { day: string }[]) => void }) {
  const blocked = useMemo(() => new Set((listing.blocks ?? []).map((b) => b.day.slice(0, 10))), [listing.blocks]);
  const [busyDay, setBusyDay] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <AvailabilityCalendar
        blocked={blocked}
        busyDay={busyDay}
        onToggle={async (day, block) => {
          setBusyDay(day);
          setError(null);
          try {
            await setBlocked(listing.id, day, block);
            onChange(block ? [...(listing.blocks ?? []), { day }] : (listing.blocks ?? []).filter((b) => b.day.slice(0, 10) !== day));
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Gagal.');
          } finally {
            setBusyDay(null);
          }
        }}
      />
      {error && <p role="alert" className="mt-1 text-sm text-red-600">{error}</p>}
    </>
  );
}

/** Food business: type, opening hours, services, halal claim and a short menu. */
function FoodFields({ d, setD, halalVerified }: { d: FoodDetails; setD: (p: Partial<FoodDetails>) => void; halalVerified: boolean }) {
  const menu = d.menu ?? [];
  const closed = new Set(d.closed_days ?? []);
  const setMenu = (next: MenuItem[]) => setD({ menu: next });
  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <label className={label}>Jenis
          <select className={input} value={d.food_type ?? 'warung'} onChange={(e) => setD({ food_type: e.target.value as FoodType })}>
            {FOOD_TYPES.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
          </select>
        </label>
        <span />
        <label className={label}>Buka<input className={input} type="time" value={d.opens ?? ''} onChange={(e) => setD({ opens: e.target.value })} /></label>
        <label className={label}>Tutup<input className={input} type="time" value={d.closes ?? ''} onChange={(e) => setD({ closes: e.target.value })} /></label>
      </div>
      <fieldset>
        <legend className={label}>Hari cuti (tutup)</legend>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {DAYS_MS.map((name, i) => {
            const on = closed.has(i);
            return (
              <button key={name} type="button" aria-pressed={on} onClick={() => setD({ closed_days: on ? [...closed].filter((x) => x !== i) : [...closed, i].sort() })} className={cn('rounded-full px-3 py-1.5 text-xs font-semibold', on ? 'bg-red-600 text-white' : 'bg-ink-100 dark:bg-ink-800')}>
                {name}
              </button>
            );
          })}
        </div>
      </fieldset>
      <fieldset>
        <legend className={label}>Servis</legend>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {FOOD_SERVICES.map((x) => {
            const on = (d.services ?? []).includes(x.id);
            return (
              <button key={x.id} type="button" aria-pressed={on} onClick={() => setD({ services: on ? (d.services ?? []).filter((y) => y !== x.id) : [...(d.services ?? []), x.id] })} className={cn('rounded-full px-3 py-1.5 text-xs font-semibold', on ? 'bg-jade-500 text-white' : 'bg-ink-100 dark:bg-ink-800')}>
                {x.label}
              </button>
            );
          })}
        </div>
      </fieldset>
      <label className={label}>Status halal
        <select className={input} value={d.halal ?? ''} onChange={(e) => setD({ halal: (e.target.value || null) as HalalClaim | null })}>
          <option value="">Tidak dinyatakan</option>
          <option value="muslim_owner">Pemilik Muslim</option>
          <option value="no_pork">Tiada daging babi</option>
          <option value="jakim" disabled={!halalVerified}>Halal JAKIM{halalVerified ? '' : ' (sijil belum disemak)'}</option>
        </select>
        <span className="mt-1 block text-xs font-normal text-ink-500">
          {halalVerified
            ? 'Sijil Halal JAKIM anda sudah disemak.'
            : 'Lencana "Halal JAKIM" hanya selepas anda muat naik sijil di Bisnes saya dan admin menyemaknya. Menggunakan perkataan halal tanpa sijil adalah kesalahan di Malaysia.'}
        </span>
      </label>
      <fieldset>
        <legend className={label}>Menu ringkas ({menu.length}/{MENU_LIMIT})</legend>
        <ul className="mt-1 space-y-1.5">
          {menu.map((m, i) => (
            <li key={i} className="flex gap-1.5">
              <input className={cn(input, 'mt-0 flex-1')} value={m.name} maxLength={50} placeholder="cth. Nasi kerabu ayam" aria-label={`Hidangan ${i + 1}`} onChange={(e) => setMenu(menu.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
              <input className={cn(input, 'mt-0 w-24')} type="number" inputMode="decimal" min={0} value={m.price ?? ''} placeholder="RM" aria-label={`Harga hidangan ${i + 1}`} onChange={(e) => setMenu(menu.map((x, j) => (j === i ? { ...x, price: e.target.value ? Number(e.target.value) : undefined } : x)))} />
              <button type="button" aria-label={`Buang hidangan ${i + 1}`} onClick={() => setMenu(menu.filter((_, j) => j !== i))} className="grid w-10 shrink-0 place-items-center rounded-xl text-ink-500 hover:bg-ink-100 dark:hover:bg-ink-800">
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
        {menu.length < MENU_LIMIT && (
          <button type="button" onClick={() => setMenu([...menu, { name: '' }])} className="mt-1.5 rounded-lg bg-ink-100 px-3 py-1.5 text-xs font-semibold dark:bg-ink-800">
            + Tambah hidangan
          </button>
        )}
        <span className="mt-1 block text-xs font-normal text-ink-500">Gambar menu penuh boleh dimuat naik di bahagian Gambar.</span>
      </fieldset>
    </>
  );
}
