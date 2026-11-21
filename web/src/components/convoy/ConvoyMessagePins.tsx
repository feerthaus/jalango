import mapboxgl from 'mapbox-gl';
import { useEffect, useRef } from 'react';
import { useConvoy } from '@/contexts/ConvoyContext';
import { useConvoyChat } from '@/contexts/ConvoyChatContext';
import { useMapContext } from '@/contexts/MapContext';
import { quickMeta } from '@/utils/convoyChat';

/** Located calls stay on the map this long ("Singgah minyak" here, "Ada bahaya" there) */
const SHOW_MS = 60 * 60_000;

/** Convoy quick calls sent with a position, as emoji pins in the sender's colour. */
export function ConvoyMessagePins() {
  const { map } = useMapContext();
  const { members } = useConvoy();
  const { messages } = useConvoyChat();
  const pins = useRef(new Map<string, mapboxgl.Marker>());

  useEffect(() => {
    if (!map) return;
    const now = Date.now();
    const keep = new Set<string>();
    for (const m of messages) {
      if (m.latitude === null || m.longitude === null || now - Date.parse(m.created_at) > SHOW_MS) continue;
      const q = quickMeta(m.quick);
      if (!q) continue;
      keep.add(m.id);
      if (pins.current.has(m.id)) continue;
      const who = members.find((x) => x.user_id === m.user_id);
      const el = document.createElement('div');
      el.className = 'grid size-9 place-items-center rounded-full bg-white text-lg shadow-float';
      el.style.border = `3px solid ${who?.color ?? '#7c3aed'}`;
      el.textContent = q.emoji;
      el.title = `${who?.display_name ?? ''}: ${q.label.ms}`;
      el.setAttribute('role', 'img');
      el.setAttribute('aria-label', el.title);
      pins.current.set(m.id, new mapboxgl.Marker({ element: el, anchor: 'center' }).setLngLat([m.longitude, m.latitude]).addTo(map));
    }
    for (const [id, marker] of pins.current) {
      if (!keep.has(id)) {
        marker.remove();
        pins.current.delete(id);
      }
    }
  }, [map, messages, members]);

  useEffect(
    () => () => {
      pins.current.forEach((m) => m.remove());
      pins.current.clear();
    },
    [],
  );

  return null;
}
