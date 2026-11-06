import { FlaskConical, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { useOncomingSetting } from '@/hooks/useOncomingSetting';
import { cn } from '@/lib/cn';

/** Profile card for the experimental oncoming-vehicle alert, with a required acknowledgement. */
export function OncomingSettings() {
  const [on, setOn] = useOncomingSetting();
  const [asking, setAsking] = useState(false);
  const [ack, setAck] = useState(false);

  return (
    <div className="mt-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-ink-200 dark:bg-ink-900 dark:ring-ink-800">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p id="oncoming-label" className="flex items-center gap-1.5 text-sm font-semibold">
            Amaran “Jangan potong”
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300">
              <FlaskConical className="size-3" /> EKSPERIMEN
            </span>
          </p>
          <p className="text-xs text-ink-500 dark:text-ink-400">Voice warning when another JalanGo driver is coming towards you on a single-carriageway road.</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-labelledby="oncoming-label"
          onClick={() => (on ? setOn(false) : setAsking(true))}
          className={cn('relative h-7 w-12 shrink-0 rounded-full transition', on ? 'bg-jade-500' : 'bg-ink-200 dark:bg-ink-700')}
        >
          <span className={cn('absolute top-0.5 size-6 rounded-full bg-white shadow transition-all', on ? 'left-[1.375rem]' : 'left-0.5')} />
        </button>
      </div>

      {asking && (
        <Sheet title="Sebelum anda hidupkan" onClose={() => setAsking(false)}>
          <div className="space-y-3 text-sm">
            <p className="flex items-start gap-2 rounded-xl bg-red-500/10 p-3 font-semibold text-red-700 dark:text-red-300">
              <TriangleAlert className="mt-0.5 size-5 shrink-0" />
              Tiada amaran ≠ selamat untuk memotong.
            </p>
            <ul className="list-disc space-y-1.5 pl-5 text-ink-600 dark:text-ink-300">
              <li>Ia <strong>hanya mengesan kenderaan yang menggunakan JalanGo</strong>. Lori, motosikal dan kereta lain tidak dikesan.</li>
              <li>GPS dan internet boleh lewat beberapa saat. Amaran mungkin lambat atau tidak muncul.</li>
              <li>Ia tidak berfungsi di lebuh raya berpembahagi dan dalam trafik perlahan.</li>
              <li>Sentiasa lihat jalan sendiri dan patuhi garisan jalan. Jangan pandang telefon ketika memotong.</li>
              <li>Semasa navigasi, kedudukan anda dikongsi <strong>tanpa nama dan tidak disimpan</strong> dengan pemandu JalanGo berdekatan supaya amaran berfungsi untuk semua.</li>
            </ul>
            <label className="flex items-start gap-2">
              <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="mt-1 size-4 accent-jade-500" />
              <span>Saya faham ini ciri eksperimen dan saya tetap bertanggungjawab sepenuhnya ke atas keputusan memotong.</span>
            </label>
            <Button
              className="w-full py-3"
              disabled={!ack}
              onClick={() => {
                setOn(true);
                setAsking(false);
                setAck(false);
              }}
            >
              Hidupkan amaran eksperimen
            </Button>
          </div>
        </Sheet>
      )}
    </div>
  );
}
