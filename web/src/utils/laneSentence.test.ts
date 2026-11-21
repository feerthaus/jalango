import { describe, expect, it } from 'vitest';
import { parseShields } from './roadShields';
import { laneSentence, usableLanes } from './laneSentence';

const L = (v: boolean[]) => v.map((valid) => ({ indications: ['straight'], valid }));

describe('laneSentence', () => {
  it('names a block of lanes on one side', () => {
    expect(laneSentence(L([false, true, true, true, true]), 'ms')).toBe('Guna 4 lorong kanan');
    expect(laneSentence(L([true, true, false, false, false]), 'ms', true)).toBe('Guna dua lorong kiri');
    expect(laneSentence(L([true, true, false, false]), 'en')).toBe('Use the 2 left lanes');
    expect(laneSentence(L([false, false, true]), 'ms')).toBe('Guna lorong paling kanan');
    expect(laneSentence(L([false, true, false]), 'ms')).toBe('Guna lorong tengah');
  });
  it('says nothing when all, none or scattered lanes are valid', () => {
    expect(laneSentence(L([true, true]), 'ms')).toBeNull();
    expect(laneSentence(L([false, false]), 'ms')).toBeNull();
    expect(laneSentence(L([true, false, true]), 'ms')).toBeNull();
    expect(laneSentence(undefined, 'ms')).toBeNull();
  });
});

describe('parseShields', () => {
  it('splits and classifies Malaysian route numbers', () => {
    expect(parseShields('E1;E2; E6')).toEqual([{ text: 'E1', kind: 'expressway' }, { text: 'E2', kind: 'expressway' }, { text: 'E6', kind: 'expressway' }]);
    expect(parseShields('FT 2')).toEqual([{ text: '2', kind: 'federal' }]);
    expect(parseShields('J200')).toEqual([{ text: 'J200', kind: 'state' }]);
    expect(parseShields('E1;E1')).toHaveLength(1);
    expect(parseShields(undefined)).toEqual([]);
  });
});

describe('usableLanes', () => {
  const step = (type: string, modifier: string | undefined, lanes: { indications: string[]; valid: boolean }[]) =>
    ({ instruction: '', distanceMeters: 0, durationSeconds: 0, maneuver: { type, modifier, location: { lat: 0, lng: 0 } }, lanes }) as Parameters<typeof usableLanes>[0];

  it('drops lanes that contradict the turn (live case: left onto Jalan P. Ramlee)', () => {
    const s = step('turn', 'left', [
      { indications: ['left'], valid: false },
      { indications: ['straight'], valid: true },
      { indications: ['straight', 'right'], valid: true },
      { indications: ['uturn'], valid: false },
    ]);
    expect(usableLanes(s)).toBeUndefined();
  });
  it('keeps lanes that agree with the turn', () => {
    const lanes = [
      { indications: ['straight'], valid: false },
      { indications: ['right'], valid: true },
    ];
    expect(usableLanes(step('turn', 'right', lanes))).toBe(lanes);
  });
  it('lets straight lanes serve a slight turn or fork', () => {
    const lanes = [
      { indications: ['left', 'straight'], valid: false },
      { indications: ['straight'], valid: true },
    ];
    expect(usableLanes(step('fork', 'slight right', lanes))).toBe(lanes);
    expect(usableLanes(step('turn', 'right', lanes))).toBeUndefined();
  });
  it('trusts unmarked lanes and needs a lane to use', () => {
    expect(usableLanes(step('turn', 'left', [{ indications: ['none'], valid: true }, { indications: ['none'], valid: false }]))).toBeDefined();
    expect(usableLanes(step('turn', 'left', [{ indications: ['left'], valid: false }, { indications: ['left'], valid: false }]))).toBeUndefined();
  });
});
