import mapboxgl from 'mapbox-gl';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMapContext } from '@/contexts/MapContext';
import { useReports } from '@/contexts/ReportsContext';
import { cn } from '@/lib/cn';
import { reportMeta } from '@/lib/reportTypes';
import type { TrafficReport } from '@/types';

/**
 * Community reports as DOM markers. React renders each icon through a
 * portal into the marker element, so markers survive style changes.
 */
export function ReportMarkers() {
  const { map } = useMapContext();
  const { reports, selectedReport, selectReport } = useReports();
  const markers = useRef(new Map<string, { marker: mapboxgl.Marker; el: HTMLElement }>());
  const [, force] = useState(0);

  useEffect(() => {
    if (!map) return;
    const current = markers.current;
    const ids = new Set(reports.map((r) => r.id));
    let changed = false;

    for (const [id, m] of current) {
      if (!ids.has(id)) {
        m.marker.remove();
        current.delete(id);
        changed = true;
      }
    }
    for (const r of reports) {
      const existing = current.get(r.id);
      if (existing) {
        existing.marker.setLngLat([r.longitude, r.latitude]);
        continue;
      }
      const el = document.createElement('div');
      const marker = new mapboxgl.Marker({ element: el, anchor: 'bottom' }).setLngLat([r.longitude, r.latitude]).addTo(map);
      current.set(r.id, { marker, el });
      changed = true;
    }
    if (changed) force((n) => n + 1);
  }, [map, reports]);

  useEffect(
    () => () => {
      for (const m of markers.current.values()) m.marker.remove();
      markers.current.clear();
    },
    [],
  );

  return (
    <>
      {reports.map((r) => {
        const m = markers.current.get(r.id);
        return m ? createPortal(<ReportPin report={r} selected={selectedReport?.id === r.id} onClick={() => selectReport(r)} />, m.el, r.id) : null;
      })}
    </>
  );
}

function ReportPin({ report, selected, onClick }: { report: TrafficReport; selected: boolean; onClick: () => void }) {
  const meta = reportMeta(report.report_type);
  const Icon = meta.icon;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      aria-label={`${meta.label} report`}
      className={cn('group relative flex flex-col items-center transition', selected ? 'z-10 scale-125' : 'hover:scale-110')}
    >
      <span className={cn('grid size-9 place-items-center rounded-full border-[3px] border-white shadow-[0_3px_8px_rgb(0_0_0/.35)]', meta.tone)}>
        <Icon className="size-[18px]" />
      </span>
      <span className="-mt-1 h-2.5 w-2.5 rotate-45 border-b-[3px] border-r-[3px] border-white bg-transparent" aria-hidden />
      {report.confirm_count > 0 && (
        <span className="absolute -right-1.5 -top-1.5 grid min-w-5 place-items-center rounded-full bg-ink-950 px-1 text-[10px] font-bold text-white ring-2 ring-white">
          {report.confirm_count}
        </span>
      )}
    </button>
  );
}
