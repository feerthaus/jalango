import { Car, ChevronDown, ChevronUp, ExternalLink, Footprints, Loader2, Navigation, PiggyBank, Play, TrainFront, Users } from 'lucide-react';
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
import { carTripCost, parkingPerDay, pickFuelPrice, trainTripCost } from '@/utils/tripCost';

const clock = (iso: string) => iso.slice(11, 16);
const dayDiff = (iso: string) => {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00+08:00`).getTime() - new Date(new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10) + 'T00:00:00+08:00').getTime();
  return Math.round(d / 86_400_000);
};
const rm = (n: number) => `RM${Number.isInteger(n) ? n : n.toFixed(2)}`;
/** "RM18.30" for a fixed fare, "RM3.60–4.8" for a range. */
const fare = (min: number, max: number) => (min === max ? rm(min) : `${rm(min)}–${max}`);

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
  const car = route && fuel ? carTripCost({ distanceMeters: route.distanceMeters, hasTolls: route.hasTolls, tollMeters: route.tollMeters, vehicle, fuelPrice: fuel.price, parkingPerDay: parking.perDay, days }) : null;
  const best = options?.length ? options.reduce((a, b) => (b.costMax < a.costMax ? b : a)) : null;
  const train = best ? trainTripCost({ fareMin: best.fareMin, fareMax: best.fareMax, rideMin: best.access.costMin + best.egress.costMin, rideMax: best.access.costMax + best.egress.costMax, people }) : null;

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
            <p className="flex items-center gap-1 text-xs font-semibold text-ink-500"><TrainFront className="size-3.5" /> {t('Pengangkutan awam', 'Public transport')}</p>
            <p className="text-xl font-black tabular-nums">{train ? `~${fare(train.min, train.max)}` : options ? '—' : '…'}</p>
            {best && <p className="text-[11px] leading-snug text-ink-500">{t(`tambang × ${people} + ke/dari stesen`, `fares × ${people} + to/from station`)}</p>}
            {best && <p className="text-[11px] text-ink-400">{formatDuration(best.minutes * 60)}</p>}
          </div>
        </div>
        {car && train && (
          <p className={cn('mt-2 flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-bold', car.total - train.max > 0 ? 'bg-jade-500/15 text-jade-800 dark:text-jade-200' : 'bg-ink-100 text-ink-700 dark:bg-ink-900 dark:text-ink-200')}>
            <PiggyBank className="size-4 shrink-0" />
            {car.total - train.max > 0
              ? t(`Naik pengangkutan awam jimat sekurang-kurangnya ${rm(car.total - train.max)}`, `Public transport saves at least ${rm(car.total - train.max)}`)
              : car.total - train.min > 0
                ? t('Kos lebih kurang sama', 'About the same cost')
                : t(`Untuk ${people} orang, memandu lebih murah`, `For ${people} people, driving is cheaper`)}
          </p>
        )}
        <p className="mt-2 text-[11px] leading-snug text-ink-400">
          {t(
            `Anggaran sehala. Minyak ${fuel ? `${fuel.label} ${rm(fuel.price)}/L` : ''}, ${vehicle === 'car' ? '7' : '3'} L/100 km; tol ~RM0.10/km; parking ${parking.zone ? `${parking.zone} ~${rm(parking.perDay)}/hari` : 'biasanya percuma di kawasan ini'}. Tambang ialah anggaran (ETS/Intercity ikut Tambang Fleksi KTMB).`,
            `One way, estimates. Fuel ${fuel ? `${fuel.label} ${rm(fuel.price)}/L` : ''}, ${vehicle === 'car' ? '7' : '3'} L/100 km; toll ~RM0.10/km; parking ${parking.zone ? `${parking.zone} ~${rm(parking.perDay)}/day` : 'usually free here'}. Fares are estimates (ETS/Intercity prices vary: KTMB Flexi Fare).`,
          )}
        </p>
      </section>

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
                <p className="mt-1 flex items-center justify-between text-xs text-ink-500">
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
                  <Step leg={o.egress} label={t(`ke ${destination?.name ?? 'destinasi'}`, `to ${destination?.name ?? 'the destination'}`)} />
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
