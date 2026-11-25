import { describe, expect, it } from 'vitest';
import { buildStaging, classify, cleanPhone, markDuplicates, settlementClass, type OsmFeature } from './rules.js';

const NOW = new Date('2026-11-23T00:00:00Z');
const f = (o: Partial<OsmFeature> & { tags: Record<string, string> }): OsmFeature => ({
  osm_ref: 'node/1',
  version: 1,
  last_edit: '2025-06-01T00:00:00Z',
  lat: 2.81,
  lng: 101.5,
  inside_boundary: true,
  inside_institution: null,
  place_tag: 'city',
  nearest_place: 'Banting',
  coastal: false,
  ...o,
});

// Cases are real records from the POI-1 audit of Kuala Langat (22–23 Nov 2026)
describe('classify: audit cases', () => {
  it('Asrama IKBN (hostel inside IKBN Kuala Langat) is rejected as an institution', () => {
    const r = classify(f({ osm_ref: 'way/682808913', tags: { tourism: 'hostel', name: 'Asrama IKBN', building: 'yes' }, inside_institution: 'Institut Kemahiran Belia Negara (IKBN) Kuala Langat' }), NOW)!;
    expect(r.category).toBe('penginapan');
    expect(r.decision).toBe('rejected');
    expect(r.reject_reason).toBe('institusi');
  });

  it('school canteens (Kantin SMS Banting) are rejected as institutions', () => {
    const r = classify(f({ tags: { amenity: 'restaurant', name: 'Kantin' }, inside_institution: 'SMS Banting (BASIS)' }), NOW)!;
    expect(r.decision).toBe('rejected');
    expect(r.reject_reason).toBe('institusi');
  });

  it('a heritage attraction inside a school goes to review, not rejection (Istana Bandar Jugra)', () => {
    const r = classify(f({ osm_ref: 'way/1387806344', tags: { historic: 'palace', name: 'Istana Bandar Jugra' }, inside_institution: 'Maahad Integrasi Tahfiz Sains Istana Bandar · amenity=school' }), NOW)!;
    expect(r.category).toBe('tarikan');
    expect(r.decision).toBe('needs_review');
    expect(r.reject_reason).toBeNull();
    expect(r.issues).toContain('institusi');
  });

  it('an unnamed mosque goes to review so an admin can name it, and is not guessed as masjid', () => {
    const r = classify(f({ osm_ref: 'way/1064287471', tags: { amenity: 'place_of_worship', religion: 'muslim', building: 'yes' } }), NOW)!;
    expect(r.decision).toBe('needs_review');
    expect(r.reject_reason).toBeNull();
    expect(r.issues).toContain('nama_kosong');
    expect(r.subcategory).toBe('ibadah');
  });

  it('an unnamed mosque inside an institution is still rejected (TUDM Jugra)', () => {
    const r = classify(f({ tags: { amenity: 'place_of_worship', religion: 'muslim' }, inside_institution: 'TUDM Jugra · landuse=military' }), NOW)!;
    expect(r.decision).toBe('rejected');
    expect(r.reject_reason).toBe('institusi');
  });

  it('other unnamed places are still rejected', () => {
    const r = classify(f({ tags: { amenity: 'restaurant' } }), NOW)!;
    expect(r.decision).toBe('rejected');
    expect(r.reject_reason).toBe('nama_kosong');
  });

  it('masjid / surau come from the name only', () => {
    expect(classify(f({ tags: { amenity: 'place_of_worship', religion: 'muslim', name: 'Surau Haji Saliman' } }), NOW)!.subcategory).toBe('surau');
    expect(classify(f({ tags: { amenity: 'place_of_worship', religion: 'muslim', name: 'Masjid Al-Khairat' } }), NOW)!.subcategory).toBe('masjid');
  });

  it('a generic name ("Surau") needs review', () => {
    const r = classify(f({ tags: { amenity: 'place_of_worship', religion: 'muslim', name: 'Surau' } }), NOW)!;
    expect(r.issues).toContain('nama_generik');
    expect(r.decision).toBe('needs_review');
  });

  it('fuel: "brand + branch" when OSM only has the brand (BHPetrol Seri Cheeding)', () => {
    const r = classify(f({ tags: { amenity: 'fuel', brand: 'BHPetrol', branch: 'Seri Cheeding' } }), NOW)!;
    expect(r.name).toBe('BHPetrol Seri Cheeding');
    expect(r.decision).toBe('auto_approved');
  });

  it('fuel with the brand only is accepted but noted', () => {
    const r = classify(f({ tags: { amenity: 'fuel', brand: 'Petronas' } }), NOW)!;
    expect(r.name).toBe('Petronas');
    expect(r.issues).toContain('nama_jenama_sahaja');
    expect(r.decision).toBe('auto_approved');
  });

  it('alternative healthcare (Pusat Rawatan DarusSyifa) gets its own subcategory and review', () => {
    const r = classify(f({ tags: { healthcare: 'alternative', name: 'Pusat Rawatan DarusSyifa' } }), NOW)!;
    expect(r.category).toBe('kesihatan');
    expect(r.subcategory).toBe('rawatan alternatif');
    expect(r.decision).toBe('needs_review');
  });

  it('doubtful categories need review (EcoWorld Gallery as a park, Alat Ganti Lori as a workshop)', () => {
    expect(classify(f({ tags: { leisure: 'park', name: 'EcoWorld Gallery @ Eco Sanctuary' } }), NOW)!.decision).toBe('needs_review');
    expect(classify(f({ tags: { shop: 'car_repair', name: 'Alat Ganti Lori Toyo Machinery' } }), NOW)!.issues).toContain('kategori_meragukan');
  });

  it('data older than 5 years is accepted with a note (Haiza, last edit 2017)', () => {
    const r = classify(f({ last_edit: '2017-12-24T00:00:00Z', tags: { shop: 'car_repair', name: 'Haiza Workshop' } }), NOW)!;
    expect(r.issues).toContain('data_lapuk');
    expect(r.decision).toBe('auto_approved');
  });

  it('a check_date keeps old data from being marked stale (7-Eleven Taman Cempaka)', () => {
    const r = classify(f({ last_edit: '2019-01-01T00:00:00Z', tags: { shop: 'convenience', name: '7-Eleven', check_date: '2026-08-21' } }), NOW)!;
    expect(r.issues).not.toContain('data_lapuk');
  });

  it('outside the district is rejected', () => {
    const r = classify(f({ inside_boundary: false, tags: { amenity: 'cafe', name: 'Starbucks' } }), NOW)!;
    expect(r.decision).toBe('rejected');
    expect(r.reject_reason).toBe('luar_kawasan');
    expect(r.settlement_class).toBe('luar');
  });

  it('objects outside the 8 categories are skipped', () => {
    expect(classify(f({ tags: { amenity: 'bench' } }), NOW)).toBeNull();
    expect(classify(f({ tags: { leisure: 'park' } }), NOW)).toBeNull(); // unnamed park
  });

  it('keeps only the allowed tags', () => {
    const r = classify(f({ tags: { amenity: 'cafe', name: 'Starbucks', brand: 'Starbucks', 'brand:wikidata': 'Q37158', 'addr:street': 'Jalan X', note: 'x' } }), NOW)!;
    expect(Object.keys(r.tags).sort()).toEqual(['addr:street', 'amenity', 'brand']);
  });
});

describe('settlement class (owner decision)', () => {
  it('city → bandar, town → pekan, village → kampung, hamlet → penempatan kecil, suburb → bandar', () => {
    expect(settlementClass('city')).toBe('bandar');
    expect(settlementClass('town')).toBe('pekan');
    expect(settlementClass('village')).toBe('kampung');
    expect(settlementClass('hamlet')).toBe('penempatan_kecil');
    expect(settlementClass('neighbourhood')).toBe('bandar');
    expect(settlementClass(null)).toBeNull(); // inside the district, no settlement within 3 km
  });
});

describe('phone', () => {
  it('normalises Malaysian numbers', () => {
    expect(cleanPhone('010-566 7861')).toBe('+60105667861');
    expect(cleanPhone('+60 3-3362 6863')).toBe('+60333626863');
    expect(cleanPhone('12')).toBe('invalid');
  });
});

describe('duplicates', () => {
  const row = (o: Partial<OsmFeature> & { tags: Record<string, string> }) => classify(f(o), NOW)!;

  it('same name and category within 50 m: the weaker record becomes a duplicate', () => {
    const out = markDuplicates([
      row({ osm_ref: 'node/1', tags: { amenity: 'restaurant', name: 'Restoran K2' } }),
      row({ osm_ref: 'node/2', lat: 2.81025, tags: { amenity: 'restaurant', name: 'Restoran K2', phone: '0123456789' } }),
    ]);
    expect(out.find((r) => r.osm_ref === 'node/1')!.decision).toBe('duplicate');
    expect(out.find((r) => r.osm_ref === 'node/2')!.decision).toBe('auto_approved');
  });

  it('branches of a chain are not duplicates (99 Speedmart: different branch)', () => {
    const out = markDuplicates([
      row({ osm_ref: 'node/1', tags: { shop: 'convenience', name: '99 Speedmart', branch: 'Taman Banting Indah' } }),
      row({ osm_ref: 'node/2', lat: 2.8101, tags: { shop: 'convenience', name: '99 Speedmart', branch: 'Taman Saujana Putra' } }),
    ]);
    expect(out.every((r) => r.decision === 'auto_approved')).toBe(true);
  });

  it('the same chain further than 50 m apart is not a duplicate (Watsons)', () => {
    const out = markDuplicates([
      row({ osm_ref: 'node/1', tags: { shop: 'chemist', name: 'Watsons' } }),
      row({ osm_ref: 'node/2', lat: 2.85, tags: { shop: 'chemist', name: 'Watsons' } }),
    ]);
    expect(out.every((r) => r.decision !== 'duplicate')).toBe(true);
  });

  it('within 100 m is a duplicate (Klinik Dr. Care Banting, node and building 59 m apart)', () => {
    const out = markDuplicates([
      row({ osm_ref: 'node/12525741957', tags: { amenity: 'clinic', name: 'Klinik Dr. Care Banting' } }),
      row({ osm_ref: 'way/825695386', lat: 2.81053, tags: { amenity: 'clinic', name: 'Klinik Dr. Care Banting', phone: '0123456789' } }),
    ]);
    expect(out.filter((r) => r.decision === 'duplicate')).toHaveLength(1);
  });

  it('more than 100 m apart is not a duplicate', () => {
    const out = markDuplicates([
      row({ osm_ref: 'node/1', tags: { amenity: 'restaurant', name: 'Restoran K2' } }),
      row({ osm_ref: 'node/2', lat: 2.811, tags: { amenity: 'restaurant', name: 'Restoran K2' } }),
    ]);
    expect(out.every((r) => r.decision !== 'duplicate')).toBe(true);
  });

  it('a clinic and a pharmacy with the same brand are two places (U.N.I. Klinik, U.n.i. Farmasi)', () => {
    const out = markDuplicates([
      row({ osm_ref: 'node/12651142829', tags: { amenity: 'pharmacy', name: 'U.n.i. Farmasi' } }),
      row({ osm_ref: 'node/12651142851', lat: 2.81045, tags: { amenity: 'clinic', name: 'U.N.I. Klinik' } }),
    ]);
    expect(out.every((r) => r.decision !== 'duplicate')).toBe(true);
  });

  it('one record per OSM object in a run', () => {
    const rows = buildStaging([f({ osm_ref: 'way/9', tags: { amenity: 'fuel', brand: 'Caltex' } }), f({ osm_ref: 'way/9', tags: { amenity: 'fuel', brand: 'Caltex' } })], NOW);
    expect(rows).toHaveLength(1);
  });
});
