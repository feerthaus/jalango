import { beforeEach, describe, expect, it, vi } from 'vitest';
import { areaFor, loadAreas, roughArea, saveAreas, type MyArea } from './myAreas';

const home: MyArea = { id: 'a', kind: 'rumah', label: 'Rumah', lat: 2.81234, lng: 101.50567 };
beforeEach(() => {
  const m = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), clear: () => m.clear() });
});

describe('my areas (on this phone only)', () => {
  it('saves and loads up to 5 areas, ignoring bad entries', () => {
    saveAreas([home, ...Array.from({ length: 6 }, (_, i) => ({ ...home, id: String(i) }))]);
    expect(loadAreas()).toHaveLength(5);
    localStorage.setItem('jalango:my-areas', JSON.stringify([home, { id: 'x', kind: 'istana', lat: 1 }, 'junk']));
    expect(loadAreas()).toEqual([home]);
    localStorage.setItem('jalango:my-areas', 'not json');
    expect(loadAreas()).toEqual([]);
  });
  it('only a ~1 km area leaves the phone', () => {
    expect(roughArea(home)).toEqual({ lat: 2.81, lng: 101.51 });
  });
  it('a place within ~1 km of an area gets that area (rounded); far places none', () => {
    expect(areaFor({ lat: 2.8152, lng: 101.5102 }, [home])).toEqual({ lat: 2.81, lng: 101.51 });
    expect(areaFor({ lat: 2.9, lng: 101.5 }, [home])).toBeNull();
    expect(areaFor({ lat: 2.81, lng: 101.5 }, [])).toBeNull();
  });
});
