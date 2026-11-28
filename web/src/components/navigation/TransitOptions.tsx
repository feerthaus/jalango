import { CalendarClock, Car, ChevronDown, ChevronUp, ExternalLink, Flag, Footprints, Loader2, Navigation, PiggyBank, Play, TrainFront, Users } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { useLocation } from '@/contexts/LocationContext';
import { useRouting } from '@/contexts/RoutingContext';
import { useMapContext } from '@/contexts/MapContext';
import { cn } from '@/lib/cn';
import { useT } from '@/lib/i18n';
import { useMyVehicle } from '@/lib/vehicle';
import { twelveGoTrainUrl } from '@/lib/partners';
import { setTrainView } from '@/lib/trainView';
import { arm } from '@/lib/arrivalAlarm';
import { startTransitTrip } from '@/lib/transitTrip';
import { loadFuel } from '@/services/fuelService';
import { fetchTransitOptions, KTMB_BOOKING_URL, rides, type AccessLeg, type Station, type TransitLeg, type TransitMode, type TransitOption } from '@/services/transitService';
import type { Place } from '@/types';
import { formatDuration } from '@/utils/format';
import { AT_STATION_KM, distText, fare, LATE_MINUTES, rm, waitText } from '@/utils/transitText';
import { carTripCost, parkingPerDay, pickFuelPrice, trainTripCost } from '@/utils/tripCost';

const clock = (iso: string) => iso.slice(11, 16);
const dayDiff = (iso: string) => {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00+08:00`).getTime() - new Date(new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10) + 'T00:00:00+08:00').getTime();
  return Math.round(d / 86_400_000);
};

/** "LRT", "ETS", … for a line badge. */
export function modeLabel(m: TransitMode, lang: string): string {
  if (m === 'monorail') return lang === 'ms' ? 'Monorel' : 'Monorail';
  if (m === 'bus') return lang === 'ms' ? 'Bas' : 'Bus';
  if (m === 'erl') return 'KLIA'; // + "Ekspres" / "Transit"
  return { ets: 'ETS', intercity: 'Intercity', komuter: 'Komuter', shuttle: 'Shuttle', lrt: 'LRT', mrt: 'MRT', brt: 'BRT' }[m];
}

/** Text colour that reads on a line colour. */
function onColor(hex: string): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return r * 0.299 + g * 0.587 + b * 0.114 > 160 ? '#000' : '#fff';
}

/**
 * "Awam" tab in the route panel: public transport to the destination (KTMB
 * ETS/Intercity/Komuter, LRT, MRT, Monorail, BRT), compared with driving (fuel
 * + toll + parking). All costs are estimates; tickets for intercity trains are
 * bought on KTMB's own site (or a partner).
 */
export function TransitOptions() {
  const [t, lang] = useT();
  const { fix } = useLocation();
  const { destination, routes, selectedIndex, planRoute, clearRoute } = useRouting();
  const { clearSelection } = useMapContext();
  const [vehicle] = useMyVehicle();
  const [options, setOptions] = useState<TransitOption[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fuel, setFuel] = useState<{ price: number; label: string } | null>(null);
  const [people, setPeople] = useState(1);
  const [days, setDays] = useState(1);
  const [open, setOpen] = useState<number | null>(0);
  const [showCost, setShowCost] = useState(false);

  const from = fix?.coordinates ?? null;
  const to = destination?.coordinates ?? null;
  const fromKey = from ? `${from.lat.toFixed(2)},${from.lng.toFixed(2)}` : '';
  useEffect(() => {
    if (!from || !to) return;
    let alive = true;
    setOptions(null);
    setError(null);
    fetchTransitOptions(from, to)
      .then((o) => alive && setOptions(o))
      .catch((e) => alive && setError(e instanceof Error ? e.message : 'error'));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromKey, to?.lat, to?.lng]);
  // Show the opened option (or the first) on the map; clear when leaving the tab
  const shown = options?.[open ?? 0] ?? null;
  useEffect(() => {
    setTrainView(shown && from && to ? { option: shown, from, to } : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown, fromKey, to?.lat, to?.lng]);
  useEffect(() => () => setTrainView(null), []);

  useEffect(() => {
    loadFuel().then((f) => setFuel(pickFuelPrice(f.prices)), () => setFuel(null));
  }, []);

  const route = routes[selectedIndex] ?? routes[0];
  const parking = useMemo(() => (to ? parkingPerDay(to) : { perDay: 0, zone: null }), [to]);
  const car = route && fuel ? carTripCost({ distanceMeters: route.distanceMeters, hasTolls: route.hasTolls, tollMeters: route.tollMeters, tollFare: route.tollFare, vehicle, fuelPrice: fuel.price, parkingPerDay: parking.perDay, days }) : null;
  const best = options?.length ? options.reduce((a, b) => (b.costMax < a.costMax ? b : a)) : null;
  const train = best ? trainTripCost({ fareMin: best.fareMin, fareMax: best.fareMax, rideMin: best.access.costMin + best.egress.costMin, rideMax: best.access.costMax + best.egress.costMax, people }) : null;

  const verdict =
    car && train
      ? car.total - train.max > 0
        ? t(`Naik pengangkutan awam jimat sekurang-kurangnya ${rm(car.total - train.max)}`, `Public transport saves at least ${rm(car.total - train.max)}`)
        : car.total - train.min > 0
          ? t('Kos lebih kurang sama', 'About the same cost')
          : t(`Untuk ${people} orang, memandu lebih murah`, `For ${people} people, driving is cheaper`)
      : null;
  // Nothing leaves for hours (late at night): say so first
  const first = options?.length ? options.reduce((a, b) => (Date.parse(rides(b)[0].depart) < Date.parse(rides(a)[0].depart) ? b : a)) : null;
  const firstRide = first ? rides(first)[0] : null;
  const wait = firstRide ? (Date.parse(firstRide.depart) - Date.now()) / 60_000 : 0;
  const late = wait > LATE_MINUTES ? wait : 0;

  if (!from) return <p className="py-6 text-center text-sm text-ink-500">{t('Menunggu lokasi anda…', 'Waiting for your location…')}</p>;

  // Walk there when the option says to walk; otherwise drive (or ride) there
  const goToStation = (s: Station, walking: boolean) => {
    const place: Place = { id: `station:${s.id}`, name: t(`Stesen ${s.name}`, `${s.name} station`), address: '', coordinates: { lat: s.lat, lng: s.lng }, kind: 'poi', source: 'osm' };
    planRoute(place, { walking });
  };

  // Follow this option step by step, with a "get off at the next stop" alarm.
  // arm() runs inside the tap: browsers only allow sound after one.
  const follow = (o: TransitOption) => {
    if (!from || !to || !destination) return;
    void arm();
    startTransitTrip({ option: o, from, to, destinationName: destination.name });
    clearRoute();
    clearSelection(); // the destination card would cover the trip panel
  };

  return (
    <div className="space-y-3 pb-3">
      {late && firstRide && (
        <p role="status" className="flex items-start gap-2 rounded-2xl bg-amber-100 p-3 text-sm text-amber-900 dark:bg-amber-900/30 dark:text-amber-100">
          <CalendarClock className="mt-0.5 size-4 shrink-0" />
          <span>
            <strong className="block">{t('Tiada tren atau bas lagi buat masa ini', 'No more trains or buses for now')}</strong>
            {dayDiff(firstRide.depart) > 0
              ? t(`Paling awal: ${firstRide.from.name}, esok ${clock(firstRide.depart)} (dalam ${waitText(late, t)})`, `First one: ${firstRide.from.name}, tomorrow ${clock(firstRide.depart)} (in ${waitText(late, t)})`)
              : t(`Paling awal: ${firstRide.from.name}, ${clock(firstRide.depart)} (dalam ${waitText(late, t)})`, `First one: ${firstRide.from.name}, ${clock(firstRide.depart)} (in ${waitText(late, t)})`)}
          </span>
        </p>
      )}

      {/* Train options */}
      {error ? (
        <p role="alert" className="rounded-2xl bg-white p-3 text-sm text-ink-500 dark:bg-ink-800">{t('Jadual tren tak dapat dimuat sekarang. Cuba lagi sebentar.', 'Couldn’t load train times right now. Try again shortly.')}</p>
      ) : !options ? (
        <p className="flex items-center justify-center gap-2 py-4 text-sm text-ink-500"><Loader2 className="size-4 animate-spin" /> {t('Mencari tren, LRT & bas…', 'Finding trains, LRT & buses…')}</p>
      ) : options.length === 0 ? (
        <p className="rounded-2xl bg-white p-3 text-sm text-ink-500 dark:bg-ink-800">
          {t('Tiada tren, LRT, MRT atau bas yang sesuai dalam 24 jam, atau tiada stesen/perhentian berhampiran sini atau destinasi.', 'No suitable train, LRT, MRT or bus in the next 24 hours, or no station or stop near here or the destination.')}
        </p>
      ) : (
        <ul className="space-y-2">
          {options.map((o, i) => (
            <li key={`${rides(o)[0].tripKey}-${o.leave}`} className={cn('rounded-2xl bg-white ring-2 dark:bg-ink-800', open === i ? 'ring-jade-500' : 'ring-transparent')}>
              <button type="button" onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i} className="w-full p-3 text-left">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-lg font-black tabular-nums">
                    {clock(rides(o)[0].depart)} → {clock(rides(o)[rides(o).length - 1].arrive)}
                    {dayDiff(rides(o)[0].depart) > 0 && <span className="ml-1 text-xs font-semibold text-amber-600">{t('esok', 'tomorrow')}</span>}
                  </span>
                  <span className="text-sm text-ink-500">{formatDuration(o.minutes * 60)}</span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-1 text-xs">
                  {rides(o).map((l, k) => (
                    <span key={k} className="flex items-center gap-1">
                      {k > 0 && <span className="text-ink-400">›</span>}
                      <LineBadge leg={l} />
                      <span className="text-ink-600 dark:text-ink-300">{l.from.name} → {l.to.name}</span>
                    </span>
                  ))}
                </div>
                <p className="mt-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 text-xs text-ink-500">
                  <span>{o.transfers === 0 ? t('Terus', 'Direct') : t(`${o.transfers} kali tukar`, `${o.transfers} change${o.transfers > 1 ? 's' : ''}`)} · {t(`keluar ${clock(o.leave)}`, `leave ${clock(o.leave)}`)}</span>
                  <span className="flex items-center gap-1 font-semibold">{t(`tambang ~${fare(o.fareMin, o.fareMax)}`, `fare ~${fare(o.fareMin, o.fareMax)}`)} {open === i ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}</span>
                </p>
              </button>
              {open === i && (
                <div className="space-y-2 border-t border-ink-100 p-3 pt-2 text-sm dark:border-ink-700">
                  <Step leg={o.access} label={t(`ke Stesen ${rides(o)[0].from.name}`, `to ${rides(o)[0].from.name} station`)} />
                  {o.legs.map((l, k) =>
                    l.type === 'walk' ? (
                      <div key={k} className="flex items-start gap-2 text-ink-600 dark:text-ink-300">
                        <Footprints className="mt-0.5 size-4 shrink-0" />
                        <span>{t(`Jalan kaki ke ${l.to.name} untuk tukar laluan (~${l.minutes} min)`, `Walk to ${l.to.name} to change lines (~${l.minutes} min)`)}</span>
                      </div>
                    ) : (
                      <div key={k} className="flex items-start gap-2">
                        <TrainFront className="mt-0.5 size-4 shrink-0" style={{ color: l.color }} />
                        <span className="min-w-0 flex-1">
                          <LineBadge leg={l} /> <strong>{clock(l.depart)}</strong> {l.from.name} → <strong>{clock(l.arrive)}</strong> {l.to.name}
                          <span className="block text-xs text-ink-500">
                            {l.routeName} · {l.km} km · {t(`${l.stops} hentian`, `${l.stops} stops`)} ·{' '}
                            {l.fareShared ? t('tambang sama (Rapid KL)', 'same fare (Rapid KL)') : t(`~${fare(l.fareMin, l.fareMax)}`, `~${fare(l.fareMin, l.fareMax)}`)}
                            {l.mode === 'bus'
                              ? ` · ${t('bayar dalam bas (tunai atau kad, ikut operator)', 'pay on the bus (cash or card, depends on the operator)')}`
                              : !l.ticket && ` · ${t("tap kad Touch 'n Go atau kad bank", "tap a Touch 'n Go or bank card")}`}
                          </span>
                        </span>
                      </div>
                    ),
                  )}
                  <Step end leg={o.egress} label={t(`ke ${destination?.name ?? 'destinasi'}`, `to ${destination?.name ?? 'the destination'}`)} />
                  <Button className="w-full py-2.5" onClick={() => follow(o)}>
                    <Play className="size-4" /> {t('Mula ikut perjalanan', 'Start this trip')}
                  </Button>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {rides(o).some((l) => l.ticket) && (
                      <a href={KTMB_BOOKING_URL} target="_blank" rel="noopener noreferrer" className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-jade-500 px-3 py-2.5 text-sm font-bold text-ink-950">
                        <ExternalLink className="size-4" /> {t('Beli tiket di KTMB', 'Buy tickets at KTMB')}
                      </a>
                    )}
                    {(() => {
                      const ticketLeg = rides(o).find((l) => l.ticket);
                      const partner = ticketLeg && twelveGoTrainUrl(ticketLeg.from.name, ticketLeg.to.name, lang);
                      return partner ? (
                        <a href={partner} target="_blank" rel="sponsored noopener noreferrer" className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-ink-100 px-3 py-2.5 text-sm font-bold text-ink-800 dark:bg-ink-900 dark:text-ink-100">
                          <ExternalLink className="size-4" /> {t('Beli melalui 12Go', 'Buy via 12Go')}
                        </a>
                      ) : null;
                    })()}
                    {o.access.type === 'walk' ? (
                      <Button variant="secondary" className="flex-1 py-2.5" onClick={() => goToStation(rides(o)[0].from, true)}>
                        <Footprints className="size-4" /> {t('Jalan kaki ke stesen', 'Walk to station')}
                      </Button>
                    ) : (
                      <Button variant="secondary" className="flex-1 py-2.5" onClick={() => goToStation(rides(o)[0].from, false)}>
                        <Navigation className="size-4" /> {t('Arah ke stesen', 'Directions to station')}
                      </Button>
                    )}
                  </div>
                  {rides(o).some((l) => l.ticket && twelveGoTrainUrl(l.from.name, l.to.name)) && (
                    <p className="text-[11px] leading-snug text-ink-400">
                      {t('12Go ialah rakan JalanGo: kami mungkin dapat komisen jika anda beli di sana, tanpa kos tambahan daripada kami. Harga dan caj 12Go mungkin berbeza dari KTMB.', '12Go is a JalanGo partner: we may earn a commission if you buy there, at no extra cost from us. 12Go’s prices and fees may differ from KTMB’s.')}
                    </p>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {/* Cost comparison: one line, opened on request (the trips come first) */}
      <section aria-label={t('Perbandingan kos', 'Cost comparison')} className="rounded-2xl bg-white text-sm dark:bg-ink-800">
        <button type="button" onClick={() => setShowCost(!showCost)} aria-expanded={showCost} className="flex w-full items-center gap-2 p-3 text-left">
          <PiggyBank className="size-4 shrink-0 text-ink-500" />
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">
              {t('Banding kos', 'Compare costs')}: {vehicle === 'car' ? t('kereta', 'car') : t('motosikal', 'motorcycle')} {car ? `~${rm(car.total)}` : '…'} · {t('awam', 'transit')} {train ? `~${fare(train.min, train.max)}` : options ? '—' : '…'}
            </span>
            {verdict && <span className="block text-xs text-ink-500">{verdict}</span>}
          </span>
          {showCost ? <ChevronUp className="size-4 shrink-0" /> : <ChevronDown className="size-4 shrink-0" />}
        </button>
        {showCost && (
          <div className="border-t border-ink-100 p-3 pt-2 dark:border-ink-700">
            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="flex w-24 shrink-0 items-center gap-1 font-semibold text-ink-500"><Users className="size-3.5" /> {t('Orang', 'People')}</span>
                {[1, 2, 3, 4].map((n) => (
                  <Pick key={n} on={people === n} onClick={() => setPeople(n)} label={t(`${n} orang`, `${n} people`)}>{n}</Pick>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <span className="w-24 shrink-0 font-semibold text-ink-500">{t('Hari di sana', 'Days there')}</span>
                {[1, 2, 3, 5].map((n) => (
                  <Pick key={n} on={days === n} onClick={() => setDays(n)} label={t(`${n} hari`, `${n} days`)}>{n}</Pick>
                ))}
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-ink-50 p-2.5 dark:bg-ink-900">
                <p className="flex items-center gap-1 text-xs font-semibold text-ink-500"><Car className="size-3.5" /> {vehicle === 'car' ? t('Kereta', 'Car') : t('Motosikal', 'Motorcycle')}</p>
                <p className="text-lg font-black leading-tight tabular-nums">{car ? `~${rm(car.total)}` : '…'}</p>
                {car && (
                  <p className="text-[11px] leading-snug text-ink-500">
                    {t(`minyak ${rm(car.fuel)} · tol ${rm(car.toll)} · parking ${rm(car.parking)}`, `fuel ${rm(car.fuel)} · toll ${rm(car.toll)} · parking ${rm(car.parking)}`)}
                  </p>
                )}
                {route && <p className="text-[11px] text-ink-400">{formatDuration(route.durationSeconds)}</p>}
              </div>
              <div className="rounded-xl bg-ink-50 p-2.5 dark:bg-ink-900">
                <p className="flex items-center gap-1 text-xs font-semibold text-ink-500"><TrainFront className="size-3.5" /> {t('Pengangkutan awam', 'Public transport')}</p>
                <p className="text-lg font-black leading-tight tabular-nums">{train ? `~${fare(train.min, train.max)}` : options ? '—' : '…'}</p>
                {best && <p className="text-[11px] leading-snug text-ink-500">{t(`tambang × ${people} + ke/dari stesen`, `fares × ${people} + to/from station`)}</p>}
                {best && <p className="text-[11px] text-ink-400">{formatDuration(best.minutes * 60)}</p>}
              </div>
            </div>
            <p className="mt-2 text-xs leading-snug text-ink-500">
              {t(
                `Anggaran sehala. Minyak ${fuel ? `${fuel.label} ${rm(fuel.price)}/L` : ''}, ${vehicle === 'car' ? '7' : '3'} L/100 km; tol ~RM0.10/km; parking ${parking.zone ? `${parking.zone} ~${rm(parking.perDay)}/hari` : 'biasanya percuma di kawasan ini'}. Tambang ialah anggaran (ETS/Intercity ikut Tambang Fleksi KTMB).`,
                `One way, estimates. Fuel ${fuel ? `${fuel.label} ${rm(fuel.price)}/L` : ''}, ${vehicle === 'car' ? '7' : '3'} L/100 km; toll ~RM0.10/km; parking ${parking.zone ? `${parking.zone} ~${rm(parking.perDay)}/day` : 'usually free here'}. Fares are estimates (ETS/Intercity prices vary: KTMB Flexi Fare).`,
              )}
            </p>
          </div>
        )}
      </section>

      <p className="text-center text-[11px] text-ink-400">{t('Jadual: KTMB, Prasarana (Rapid KL, Rapid Penang) dan myBAS JB melalui data.gov.my. KLIA Ekspres & Transit: anggaran ikut corak perkhidmatan ERL (setiap 15–30 min), bukan jadual rasmi.', 'Timetables: KTMB, Prasarana (Rapid KL, Rapid Penang) and myBAS JB via data.gov.my. KLIA Ekspres & Transit: estimated from ERL’s service pattern (every 15–30 min), not an official timetable.')}</p>
    </div>
  );
}

export function LineBadge({ leg }: { leg: TransitLeg }) {
  const [, lang] = useT();
  const rapid = ['lrt', 'mrt', 'monorail', 'brt'].includes(leg.mode);
  return (
    <span className="inline-block rounded px-1.5 py-0.5 text-[11px] font-bold leading-none" style={{ background: leg.color, color: onColor(leg.color) }}>
      {modeLabel(leg.mode, lang)}
      {(rapid || leg.mode === 'bus' || leg.mode === 'erl') && leg.shortName ? ` ${leg.shortName}` : ''}
    </span>
  );
}

function Step({ leg, label, end }: { leg: AccessLeg; label: string; end?: boolean }) {
  const [t] = useT();
  if (end && leg.km < AT_STATION_KM)
    return (
      <div className="flex items-start gap-2 text-ink-600 dark:text-ink-300">
        <Flag className="mt-0.5 size-4 shrink-0" />
        <span>{t('Destinasi betul-betul di stesen ini', 'The destination is right at this station')}</span>
      </div>
    );
  const Icon = leg.type === 'walk' ? Footprints : Car;
  const d = distText(leg.km);
  return (
    <div className="flex items-start gap-2 text-ink-600 dark:text-ink-300">
      <Icon className="mt-0.5 size-4 shrink-0" />
      <span>
        {leg.type === 'walk' ? t(`Jalan kaki ${d} ${label} (~${leg.minutes} min)`, `Walk ${d} ${label} (~${leg.minutes} min)`) : t(`Grab/teksi ${d} ${label} (~${leg.minutes} min, ~${fare(leg.costMin, leg.costMax)})`, `Grab/taxi ${d} ${label} (~${leg.minutes} min, ~${fare(leg.costMin, leg.costMax)})`)}
      </span>
    </div>
  );
}

function Pick({ on, onClick, label, children }: { on: boolean; onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on} aria-label={label} className={cn('grid size-10 place-items-center rounded-full text-sm font-bold', on ? 'bg-jade-500 text-ink-950' : 'bg-ink-100 text-ink-600 dark:bg-ink-900 dark:text-ink-300')}>
      {children}
    </button>
  );
}
