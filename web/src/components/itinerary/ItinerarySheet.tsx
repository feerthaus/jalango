import { ArrowDown, ArrowUp, Check, Navigation, SkipForward, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { useItinerary } from '@/contexts/ItineraryContext';
import { cn } from '@/lib/cn';

/** The day's stops: reorder, remove, and drive them one by one. */
export function ItinerarySheet({ onClose }: { onClose: () => void }) {
  const { stops, nextIndex, activeIndex, remove, move, clear, goNext, skip } = useItinerary();
  const left = stops.filter((s) => !s.done).length;
  return (
    <Sheet title="Itinerari" onClose={onClose}>
      {stops.length === 0 ? (
        <div className="space-y-2 text-sm text-ink-600 dark:text-ink-300">
          <p>Senarai hentian untuk hari ini, contohnya lawatan pelancong, hantar barang, atau singgah rumah saudara masa balik kampung.</p>
          <p>
            Cari tempat (atau tekan lama di peta), kemudian tekan <strong>“+ Itinerari”</strong> pada kad tempat itu.
          </p>
        </div>
      ) : (
        <>
          <ol className="divide-y divide-ink-100 rounded-2xl bg-ink-50 dark:divide-ink-800 dark:bg-ink-800/50">
            {stops.map((s, i) => (
              <li key={`${s.place.id}-${i}`} className={cn('flex items-center gap-2 p-3', s.done && 'opacity-50')}>
                <span
                  className={cn(
                    'grid size-7 shrink-0 place-items-center rounded-full text-xs font-black',
                    s.done ? 'bg-jade-500 text-ink-950' : i === activeIndex ? 'bg-violet-600 text-white' : 'bg-white ring-1 ring-ink-300 dark:bg-ink-900 dark:ring-ink-600',
                  )}
                >
                  {s.done ? <Check className="size-4" /> : i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className={cn('truncate text-sm font-semibold', s.done && 'line-through')}>{s.place.name}</p>
                  {s.place.address && <p className="truncate text-xs text-ink-500">{s.place.address}</p>}
                  {i === activeIndex && <p className="text-xs font-semibold text-violet-600">Sedang menuju</p>}
                </div>
                <div className="flex shrink-0 items-center">
                  <IconBtn label={`Naik: ${s.place.name}`} onClick={() => move(i, -1)} disabled={i === 0}>
                    <ArrowUp className="size-4" />
                  </IconBtn>
                  <IconBtn label={`Turun: ${s.place.name}`} onClick={() => move(i, 1)} disabled={i === stops.length - 1}>
                    <ArrowDown className="size-4" />
                  </IconBtn>
                  {!s.done && i !== activeIndex && (
                    <IconBtn label={`Langkau: ${s.place.name}`} onClick={() => skip(i)}>
                      <SkipForward className="size-4" />
                    </IconBtn>
                  )}
                  <IconBtn label={`Buang: ${s.place.name}`} onClick={() => remove(i)}>
                    <Trash2 className="size-4" />
                  </IconBtn>
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-2 text-xs text-ink-500">{left === 0 ? 'Semua hentian selesai 🎉' : `${left} hentian lagi.`}</p>
          <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
            <Button
              className="py-3"
              disabled={nextIndex === -1 || nextIndex === activeIndex}
              onClick={() => {
                goNext();
                onClose();
              }}
            >
              <Navigation className="size-4" fill="currentColor" />
              {nextIndex === -1 ? 'Selesai' : `Pergi: ${stops[nextIndex].place.name.slice(0, 22)}`}
            </Button>
            <Button variant="ghost" onClick={clear}>
              Kosongkan
            </Button>
          </div>
        </>
      )}
    </Sheet>
  );
}

function IconBtn({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" aria-label={label} onClick={onClick} disabled={disabled} className="grid size-8 place-items-center rounded-full text-ink-500 hover:bg-ink-200 disabled:opacity-30 dark:hover:bg-ink-700">
      {children}
    </button>
  );
}
