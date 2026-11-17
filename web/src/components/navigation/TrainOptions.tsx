import { Car, ChevronDown, ChevronUp, ExternalLink, Footprints, Loader2, Navigation, PiggyBank, TrainFront, Users } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { useLocation } from '@/contexts/LocationContext';
import { useRouting } from '@/contexts/RoutingContext';
import { cn } from '@/lib/cn';
import { useT } from '@/lib/i18n';
import { useMyVehicle } from '@/lib/vehicle';
import { loadFuel } from '@/services/fuelService';
import { fetchTrainOptions, KTMB_BOOKING_URL, type AccessLeg, type TrainOption } from '@/services/transitService';
import type { Place } from '@/types';
import { formatDuration } from '@/utils/format';
import { carTripCost, parkingPerDay, pickFuelPrice, trainTripCost } from '@/utils/tripCost';

const clock = (iso: string) => iso.slice(11, 16);
const dayDiff = (iso: string) => {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00+08:00`).getTime() - new Date(new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10) + 'T00:00:00+08:00').getTime();
  return Math.round(d / 86_400_000);
};
const rm = (n: number) => `RM${Number.isInteger(n) ? n : n.toFixed(2)}`;

/**
 * "Tren" tab in the route panel: KTMB trains to the destination, compared with
 * driving (fuel + toll + parking). All costs are estimates; tickets are bought
 * on KTMB's own site for now.
 */
export function TrainOptions() {
  const [t] = useT();
  const { fix } = useLocation();
  const { destination, routes, selectedIndex, planRoute } = useRouting();
  const [vehicle] = useMyVehicle();
  const [options, setOptions] = useState<TrainOption[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fuel, setFuel] = useState<{ price: number; label: string } | null>(null);
  const [people, setPeople] = useState(1);
  const [days, setDays] = useState(1);
  const [open, setOpen] = useState<number | null>(0);

  const from = fix?.coordinates ?? null;
  const to = destination?.coordinates ?? null;
  const fromKey = from ? `${from.lat.toFixed(2)},${from.lng.toFixed(2)}` : '';
  useEffect(() => {
    if (!from || !to) return;
    const ctrl = new AbortController();
    setOptions(null);
    setError(null);
    fetchTrainOptions(from, to, ctrl.signal)
      .then((o) => !ctrl.signal.aborted && setOptions(o))
      .catch((e) => !ctrl.signal.aborted && setError(e instanceof Error ? e.message : 'error'));
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromKey, to?.lat, to?.lng]);
  useEffect(() => {
    loadFuel().then((f) => setFuel(pickFuelPrice(f.prices)), () => setFuel(null));
  }, []);

  const route = routes[selectedIndex] ?? routes[0];
  const parking = useMemo(() => (to ? parkingPerDay(to) : { perDay: 0, zone: null }), [to]);
  const car = route && fuel ? carTripCost({ distanceMeters: route.distanceMeters, hasTolls: route.hasTolls, vehicle, fuelPrice: fuel.price, parkingPerDay: parking.perDay, days }) : null;
  const best = options?.length ? options.reduce((a, b) => (b.costMax < a.costMax ? b : a)) : null;
  const train = best ? trainTripCost({ fareMin: best.fareMin, fareMax: best.fareMax, rideMin: best.access.costMin + best.egress.costMin, rideMax: best.access.costMax + best.egress.costMax, people }) : null;

  if (!from) return <p className="py-6 text-center text-sm text-ink-500">{t('Menunggu lokasi anda…', 'Waiting for your location…')}</p>;

  const goToStation = (s: TrainOption['legs'][number]['from']) => {
    const place: Place = { id: `ktmb:${s.id}`, name: t(`Stesen ${s.name}`, `${s.name} station`), address: 'KTMB', coordinates: { lat: s.lat, lng: s.lng }, kind: 'poi', source: 'osm' };
    planRoute(place);
  };

  return (
    <div className="space-y-3 pb-3">
      {/* Cost comparison */}
      <section aria-label={t('Perbandingan kos', 'Cost comparison')} className="rounded-2xl bg-white p-3 text-sm dark:bg-ink-800">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="flex items-center gap-1 font-semibold text-ink-500"><Users className="size-3.5" /> {t('Orang', 'People')}</span>
          {[1, 2, 3, 4].map((n) => (
            <Pick key={n} on={people === n} onClick={() => setPeople(n)}>{n}</Pick>
          ))}
          <span className="ml-2 font-semibold text-ink-500">{t('Hari di sana', 'Days there')}</span>
          {[1, 2, 3, 5].map((n) => (
            <Pick key={n} on={days === n} onClick={() => setDays(n)}>{n}</Pick>
          ))}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-ink-50 p-2.5 dark:bg-ink-900">
            <p className="flex items-center gap-1 text-xs font-semibold text-ink-500"><Car className="size-3.5" /> {vehicle === 'car' ? t('Kereta', 'Car') : t('Motosikal', 'Motorcycle')}</p>
            <p className="text-xl font-black tabular-nums">{car ? `~${rm(car.total)}` : '…'}</p>
            {car && (
              <p className="text-[11px] leading-snug text-ink-500">
                {t(`minyak ${rm(car.fuel)} · tol ${rm(car.toll)} · parking ${rm(car.parking)}`, `fuel ${rm(car.fuel)} · toll ${rm(car.toll)} · parking ${rm(car.parking)}`)}
              </p>
            )}
            {route && <p className="text-[11px] text-ink-400">{formatDuration(route.durationSeconds)}</p>}
          </div>
          <div className="rounded-xl bg-ink-50 p-2.5 dark:bg-ink-900">
            <p className="flex items-center gap-1 text-xs font-semibold text-ink-500"><TrainFront className="size-3.5" /> {t('Tren', 'Train')}</p>
            <p className="text-xl font-black tabular-nums">{train ? `~${rm(train.min)}–${train.max}` : options ? '—' : '…'}</p>
            {best && <p className="text-[11px] leading-snug text-ink-500">{t(`tambang × ${people} + ke/dari stesen`, `fares × ${people} + to/from station`)}</p>}
            {best && <p className="text-[11px] text-ink-400">{formatDuration(best.minutes * 60)}</p>}
          </div>
        </div>
        {car && train && (
          <p className={cn('mt-2 flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-bold', car.total - train.max > 0 ? 'bg-jade-500/15 text-jade-800 dark:text-jade-200' : 'bg-ink-100 text-ink-700 dark:bg-ink-900 dark:text-ink-200')}>
            <PiggyBank className="size-4 shrink-0" />
            {car.total - train.max > 0
              ? t(`Naik tren jimat sekurang-kurangnya ${rm(car.total - train.max)}`, `The train saves at least ${rm(car.total - train.max)}`)
              : car.total - train.min > 0
                ? t('Kos lebih kurang sama', 'About the same cost')
                : t(`Untuk ${people} orang, memandu lebih murah`, `For ${people} people, driving is cheaper`)}
          </p>
        )}
        <p className="mt-2 text-[11px] leading-snug text-ink-400">
          {t(
            `Anggaran sehala. Minyak ${fuel ? `${fuel.label} ${rm(fuel.price)}/L` : ''}, ${vehicle === 'car' ? '7' : '3'} L/100 km; tol ~RM0.10/km; parking ${parking.zone ? `${parking.zone} ~${rm(parking.perDay)}/hari` : 'biasanya percuma di kawasan ini'}. Tambang tren ialah anggaran: harga sebenar ikut Tambang Fleksi KTMB.`,
            `One way, estimates. Fuel ${fuel ? `${fuel.label} ${rm(fuel.price)}/L` : ''}, ${vehicle === 'car' ? '7' : '3'} L/100 km; toll ~RM0.10/km; parking ${parking.zone ? `${parking.zone} ~${rm(parking.perDay)}/day` : 'usually free here'}. Train fares are estimates: KTMB prices vary (Flexi Fare).`,
          )}
        </p>
      </section>

      {/* Train options */}
      {error ? (
        <p role="alert" className="rounded-2xl bg-white p-3 text-sm text-ink-500 dark:bg-ink-800">{t('Jadual tren tak dapat dimuat sekarang. Cuba lagi sebentar.', 'Couldn’t load train times right now. Try again shortly.')}</p>
      ) : !options ? (
        <p className="flex items-center justify-center gap-2 py-4 text-sm text-ink-500"><Loader2 className="size-4 animate-spin" /> {t('Mencari tren…', 'Finding trains…')}</p>
      ) : options.length === 0 ? (
        <p className="rounded-2xl bg-white p-3 text-sm text-ink-500 dark:bg-ink-800">
          {t('Tiada tren KTMB yang sesuai dalam 24 jam, atau tiada stesen dalam 40 km dari sini atau destinasi.', 'No suitable KTMB train in the next 24 hours, or no station within 40 km of here or the destination.')}
        </p>
      ) : (
        <ul className="space-y-2">
          {options.map((o, i) => (
            <li key={`${o.legs[0].tripId}-${o.leave}`} className={cn('rounded-2xl bg-white ring-2 dark:bg-ink-800', open === i ? 'ring-jade-500' : 'ring-transparent')}>
              <button type="button" onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i} className="w-full p-3 text-left">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-lg font-black tabular-nums">
                    {clock(o.legs[0].depart)} → {clock(o.legs[o.legs.length - 1].arrive)}
                    {dayDiff(o.legs[0].depart) > 0 && <span className="ml-1 text-xs font-semibold text-amber-600">{t('esok', 'tomorrow')}</span>}
                  </span>
                  <span className="text-sm text-ink-500">{formatDuration(o.minutes * 60)}</span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-1 text-xs">
                  {o.legs.map((l, k) => (
                    <span key={k} className="flex items-center gap-1">
                      {k > 0 && <span className="text-ink-400">›</span>}
                      <span className="rounded px-1.5 py-0.5 font-bold" style={{ background: l.color, color: l.kind === 'ets' ? '#000' : '#fff' }}>{l.kind === 'ets' ? 'ETS' : l.kind === 'komuter' ? 'Komuter' : l.kind === 'shuttle' ? 'Shuttle' : 'Intercity'}</span>
                      <span className="text-ink-600 dark:text-ink-300">{l.from.name} → {l.to.name}</span>
                    </span>
                  ))}
                </div>
                <p className="mt-1 flex items-center justify-between text-xs text-ink-500">
                  <span>{o.transfers === 0 ? t('Terus', 'Direct') : t(`${o.transfers} tukar tren`, `${o.transfers} change`)} · {t(`keluar ${clock(o.leave)}`, `leave ${clock(o.leave)}`)}</span>
                  <span className="flex items-center gap-1 font-semibold">{t(`tambang ~${rm(o.fareMin)}–${o.fareMax}`, `fare ~${rm(o.fareMin)}–${o.fareMax}`)} {open === i ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}</span>
                </p>
              </button>
              {open === i && (
                <div className="space-y-2 border-t border-ink-100 p-3 pt-2 text-sm dark:border-ink-700">
                  <Step leg={o.access} label={t(`ke Stesen ${o.legs[0].from.name}`, `to ${o.legs[0].from.name} station`)} />
                  {o.legs.map((l, k) => (
                    <div key={k} className="flex items-start gap-2">
                      <TrainFront className="mt-0.5 size-4 shrink-0" style={{ color: l.color }} />
                      <span className="min-w-0 flex-1">
                        <strong>{clock(l.depart)}</strong> {l.from.name} → <strong>{clock(l.arrive)}</strong> {l.to.name}
                        <span className="block text-xs text-ink-500">
                          {l.routeName} · {l.km} km · {t(`${l.stops} hentian`, `${l.stops} stops`)} · {t(`~${rm(l.fareMin)}–${l.fareMax}`, `~${rm(l.fareMin)}–${l.fareMax}`)}
                          {!l.ticket && ` · ${t("tap kad Touch 'n Go", "tap a Touch 'n Go card")}`}
                        </span>
                      </span>
                    </div>
                  ))}
                  <Step leg={o.egress} label={t(`ke ${destination?.name ?? 'destinasi'}`, `to ${destination?.name ?? 'the destination'}`)} />
                  <div className="flex flex-wrap gap-2 pt-1">
                    {o.legs.some((l) => l.ticket) && (
                      <a href={KTMB_BOOKING_URL} target="_blank" rel="noopener noreferrer" className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-jade-500 px-3 py-2.5 text-sm font-bold text-ink-950">
                        <ExternalLink className="size-4" /> {t('Beli tiket di KTMB', 'Buy tickets at KTMB')}
                      </a>
                    )}
                    <Button variant="secondary" className="flex-1 py-2.5" onClick={() => goToStation(o.legs[0].from)}>
                      <Navigation className="size-4" /> {t('Arah ke stesen', 'Directions to station')}
                    </Button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="text-center text-[11px] text-ink-400">{t('Jadual: KTMB melalui data.gov.my, dikemas kini setiap hari.', 'Timetable: KTMB via data.gov.my, updated daily.')}</p>
    </div>
  );
}

function Step({ leg, label }: { leg: AccessLeg; label: string }) {
  const [t] = useT();
  const Icon = leg.type === 'walk' ? Footprints : Car;
  return (
    <div className="flex items-start gap-2 text-ink-600 dark:text-ink-300">
      <Icon className="mt-0.5 size-4 shrink-0" />
      <span>
        {leg.type === 'walk' ? t(`Jalan kaki ${leg.km} km ${label} (~${leg.minutes} min)`, `Walk ${leg.km} km ${label} (~${leg.minutes} min)`) : t(`Grab/teksi ${leg.km} km ${label} (~${leg.minutes} min, ~RM${leg.costMin}–${leg.costMax})`, `Grab/taxi ${leg.km} km ${label} (~${leg.minutes} min, ~RM${leg.costMin}–${leg.costMax})`)}
      </span>
    </div>
  );
}

function Pick({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on} className={cn('grid size-7 place-items-center rounded-full font-bold', on ? 'bg-jade-500 text-ink-950' : 'bg-ink-100 text-ink-600 dark:bg-ink-900 dark:text-ink-300')}>
      {children}
    </button>
  );
}
