import { describe, expect, it } from 'vitest';
import type { AlongRow } from '@/contexts/AlongContext';
import { labelledIds, pinHtml } from './alongPins';

const row = (id: string, ahead: number, extra: Partial<AlongRow> = {}): AlongRow =>
  ({ place: { id, name: id, address: '', coordinates: { lat: 0, lng: 0 }, kind: 'poi', source: 'mapbox' }, ahead, offset: 0, side: null, ...extra }) as AlongRow;

describe('along pins', () => {
  it('labels the next 10 ahead plus picks and checked shops', () => {
    const rows = [row('behind', -100), ...Array.from({ length: 14 }, (_, i) => row(`a${i}`, (i + 1) * 1000)), row('far-pick', 90_000, { pick: {} as AlongRow['pick'] }), row('far-shop', 95_000, { listing: {} as AlongRow['listing'] })];
    const ids = labelledIds(rows);
    expect(ids.has('a0') && ids.has('a9')).toBe(true);
    expect(ids.has('a10')).toBe(false);
    expect(ids.has('behind')).toBe(false);
    expect(ids.has('far-pick') && ids.has('far-shop')).toBe(true);
  });
  it('escapes names and shows Buka/Tutup', () => {
    const html = pinHtml('#ea580c', '<path/>', null, { name: '<img src=x onerror=alert(1)> Warung "A"', open: true });
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt; Warung &quot;A&quot;');
    expect(html).toContain('Buka');
    expect(pinHtml('#ea580c', '<path/>', null, { name: 'X', open: false })).toContain('Tutup');
    expect(pinHtml('#ea580c', '<path/>', null, null)).not.toContain('top:33px');
    expect(pinHtml('#ea580c', '<path/>', 'verified', null)).toContain('✓');
    expect(pinHtml('#ea580c', '<path/>', 'pick', null)).toContain('⭐');
  });
});
