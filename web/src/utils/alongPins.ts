import type { AlongRow } from '@/contexts/AlongContext';

const esc = (t: string) => t.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** Pin, optionally with a short name label underneath (and Buka/Tutup for checked shops). */
export function pinHtml(color: string, glyph: string, badge: 'pick' | 'verified' | null, label?: { name: string; open: boolean | null } | null): string {
  const bg = badge ? '#10b981' : color;
  const status = label && label.open !== null ? `<span style="color:${label.open ? '#4ade80' : '#f87171'}"> · ${label.open ? 'Buka' : 'Tutup'}</span>` : '';
  const text = label
    ? `<span style="position:absolute;top:33px;left:50%;transform:translateX(-50%);white-space:nowrap;max-width:150px;overflow:hidden;text-overflow:ellipsis;font:600 11px/1.3 system-ui,sans-serif;color:#fff;background:rgb(15 23 42 / .88);padding:2px 7px;border-radius:9px;pointer-events:none">${esc(label.name)}${status}</span>`
    : '';
  return `
    <div style="display:grid;place-items:center;width:30px;height:30px;border-radius:9999px;background:${bg};border:2.5px solid #fff;box-shadow:0 2px 6px rgb(0 0 0 / .4)">
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${glyph}</svg>
    </div>
    ${badge === 'pick' ? '<span style="position:absolute;top:-5px;right:-6px;font-size:12px">⭐</span>' : ''}${badge === 'verified' ? '<span style="position:absolute;top:-5px;right:-6px;display:grid;place-items:center;width:15px;height:15px;border-radius:9999px;background:#fff;color:#059669;font:900 10px/1 system-ui">✓</span>' : ''}${text}`;
}

/** Labels only for the next few places ahead plus checked shops and community picks, so the map stays readable while driving. */
const LABEL_NEXT = 10;
export function labelledIds(rows: AlongRow[]): Set<string> {
  const ahead = rows.filter((r) => r.ahead >= 0).sort((a, b) => a.ahead - b.ahead).slice(0, LABEL_NEXT);
  return new Set([...ahead, ...rows.filter((r) => r.pick || r.listing)].map((r) => r.place.id));
}

