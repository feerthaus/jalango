import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseWarnings } from './weather.js';

// Real MetMalaysia feed from data.gov.my, 19 Nov 2026 (open data)
const raw = JSON.parse(readFileSync(new URL('./fixtures/weather-warning-2026-11-19.json', import.meta.url), 'utf8'));
const at = (s: string) => Date.parse(`${s}+08:00`);

describe('MetMalaysia warnings', () => {
  it('keeps land warnings with their states, drops marine-only and "no advisory"', () => {
    const w = parseWarnings(raw, at('2026-11-19T11:00:00'));
    expect(w).toHaveLength(1);
    expect(w[0]).toMatchObject({ kind: 'thunderstorm', title_bm: 'Amaran Ribut Petir', valid_to: '2026-11-19T13:00:00+08:00' });
    expect(w[0].states.sort()).toEqual(['melaka', 'ns', 'terengganu']);
    expect(w[0].text_bm).toContain('Port Dickson');
  });

  it('drops warnings that are over', () => {
    expect(parseWarnings(raw, at('2026-11-19T13:30:00'))).toHaveLength(0);
  });

  it('reads heavy rain and bad weather, any state spelling', () => {
    const w = parseWarnings(
      [
        { warning_issue: { issued: '2026-11-20T08:00:00', title_bm: 'Amaran Hujan Berterusan (Tahap Buruk)', title_en: 'Continuous Rain Warning (Bad Level)' }, valid_from: '2026-11-20T08:00:00', valid_to: '2026-11-21T20:00:00', text_bm: 'Hujan berterusan dijangka di Kelantan (Kota Bharu, Pasir Mas) dan Pulau Pinang.', text_en: '' },
        { warning_issue: { issued: '2026-11-20T08:00:00', title_bm: 'Amaran Cuaca Buruk', title_en: 'Bad Weather Warning' }, valid_from: null, valid_to: null, text_bm: 'Wilayah Persekutuan Kuala Lumpur dan Putrajaya; N. Sembilan', text_en: '' },
      ],
      at('2026-11-20T09:00:00'),
    );
    expect(w.map((x) => x.kind)).toEqual(['rain', 'bad_weather']);
    expect(w[0].states.sort()).toEqual(['kelantan', 'penang']);
    expect(w[1].states.sort()).toEqual(['kl', 'ns', 'putrajaya']);
    expect(w[0].text_en).toBe(w[0].text_bm); // no English text: Malay shown instead
  });
});
