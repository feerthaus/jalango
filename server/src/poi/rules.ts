// POI import rules (POI-2B design §4, from the audit of 50 real OSM samples, Nov 2026).
// Pure functions with no imports: the import script in GitHub Actions runs this
// file directly with Node (type stripping), and Vitest tests it in CI.

export const POI_CATEGORIES = ['restoran', 'penginapan', 'minyak', 'bengkel', 'runcit', 'kesihatan', 'tarikan', 'ibadah'] as const;
export type PoiCategory = (typeof POI_CATEGORIES)[number];
export type SettlementClass = 'bandar' | 'pekan' | 'kampung' | 'penempatan_kecil' | 'luar';
export type ImportDecision = 'auto_approved' | 'needs_review' | 'rejected' | 'duplicate';

/** One OSM object as the extract script sees it (one record per object: way and area exports already merged). */
export interface OsmFeature {
  /** node/123, way/456 or relation/789 */
  osm_ref: string;
  version: number | null;
  /** ISO date of the last edit */
  last_edit: string | null;
  tags: Record<string, string>;
  lat: number;
  lng: number;
  inside_boundary: boolean;
  /** name/tags of the school, college, camp or government area it lies in */
  inside_institution: string | null;
  /** OSM place=* of the nearest settlement within 3 km, and its name */
  place_tag: string | null;
  nearest_place: string | null;
  coastal: boolean;
}

/** A row for public.poi_staging (matches poi_ingest's columns). */
export interface StagingRow {
  osm_ref: string;
  osm_version: number | null;
  osm_last_edit: string | null;
  name: string | null;
  category: PoiCategory;
  subcategory: string | null;
  brand: string | null;
  branch: string | null;
  lat: number;
  lng: number;
  address: string | null;
  phone: string | null;
  website: string | null;
  opening_hours: string | null;
  tags: Record<string, string>;
  /** null: inside the district but no settlement within 3 km ('luar' is only for outside the district) */
  settlement_class: SettlementClass | null;
  osm_place_tag: string | null;
  nearest_place: string | null;
  coastal: boolean;
  inside_institution: string | null;
  issues: string[];
  quality: number;
  decision: ImportDecision;
  reject_reason: string | null;
}

// ── categories (POI engine report §4) ─────────────────────────────────────
const CATS: [PoiCategory, (t: Record<string, string>) => boolean][] = [
  ['restoran', (t) => ['restaurant', 'fast_food', 'cafe', 'food_court'].includes(t.amenity) || t.shop === 'bakery'],
  ['penginapan', (t) => ['hotel', 'motel', 'guest_house', 'hostel', 'chalet', 'apartment'].includes(t.tourism) || t.leisure === 'resort'],
  ['minyak', (t) => t.amenity === 'fuel'],
  ['bengkel', (t) => ['car_repair', 'tyres', 'motorcycle_repair'].includes(t.shop) || (t.shop === 'motorcycle' && t['service:vehicle:repair'] === 'yes') || t.amenity === 'car_wash'],
  ['runcit', (t) => ['convenience', 'supermarket', 'general', 'grocery', 'department_store'].includes(t.shop) || t.amenity === 'marketplace'],
  ['kesihatan', (t) => ['clinic', 'doctors', 'dentist', 'pharmacy', 'hospital'].includes(t.amenity) || t.shop === 'chemist' || Boolean(t.healthcare)],
  ['tarikan', (t) => ['attraction', 'museum', 'viewpoint', 'theme_park', 'zoo', 'gallery'].includes(t.tourism) || (Boolean(t.historic) && Boolean(t.name)) || (t.natural === 'beach' && Boolean(t.name)) || (t.leisure === 'park' && Boolean(t.name))],
  ['ibadah', (t) => t.amenity === 'place_of_worship' && t.religion === 'muslim'],
];

export function categoriesOf(tags: Record<string, string>): PoiCategory[] {
  return CATS.filter(([, test]) => test(tags)).map(([c]) => c);
}

export function subcategoryOf(c: PoiCategory, t: Record<string, string>, name: string | null): string | null {
  switch (c) {
    case 'restoran':
      return t.shop === 'bakery' ? 'bakeri' : ({ restaurant: 'restoran', fast_food: 'makanan segera', cafe: 'kafe', food_court: 'medan selera' } as Record<string, string>)[t.amenity] ?? null;
    case 'penginapan':
      return t.leisure === 'resort' ? 'resort' : ({ hotel: 'hotel', motel: 'motel', guest_house: 'rumah tumpangan', hostel: 'hostel', chalet: 'chalet', apartment: 'apartmen' } as Record<string, string>)[t.tourism] ?? null;
    case 'minyak':
      return (t.brand || t.operator || 'tanpa jenama').slice(0, 30);
    case 'bengkel':
      return t.amenity === 'car_wash' ? 'cuci kereta' : ({ car_repair: 'bengkel kereta', tyres: 'tayar', motorcycle_repair: 'bengkel motosikal', motorcycle: 'bengkel motosikal' } as Record<string, string>)[t.shop] ?? null;
    case 'runcit':
      return t.amenity === 'marketplace' ? 'pasar' : ({ convenience: 'kedai serbaneka', supermarket: 'pasar raya', general: 'kedai runcit', grocery: 'kedai runcit', department_store: 'gedung' } as Record<string, string>)[t.shop] ?? null;
    case 'kesihatan':
      if (t.healthcare === 'alternative') return 'rawatan alternatif';
      return t.shop === 'chemist' ? 'farmasi' : ({ clinic: 'klinik', doctors: 'klinik', dentist: 'klinik gigi', pharmacy: 'farmasi', hospital: 'hospital' } as Record<string, string>)[t.amenity] ?? 'kesihatan';
    case 'tarikan':
      return t.tourism ?? (t.historic ? 'bersejarah' : t.natural === 'beach' ? 'pantai' : 'taman');
    case 'ibadah':
      // Only from the name: an unnamed or other name stays "ibadah" (no guessing masjid vs surau)
      if (/\b(surau|musolla|musalla|musholla)\b/i.test(name ?? '')) return 'surau';
      if (/\bmasjid\b/i.test(name ?? '')) return 'masjid';
      return 'ibadah';
  }
}

// ── settlement class (owner's decision, 22 Nov 2026) ─────────────────────
// null when there is no OSM settlement within 3 km. 'luar' means outside the
// district (the database refuses to approve those), so it is never used here.
export function settlementClass(placeTag: string | null): Exclude<SettlementClass, 'luar'> | null {
  switch (placeTag) {
    case 'city':
    case 'suburb':
    case 'quarter':
    case 'neighbourhood':
      return 'bandar';
    case 'town':
      return 'pekan';
    case 'village':
      return 'kampung';
    case 'hamlet':
    case 'isolated_dwelling':
      return 'penempatan_kecil';
    default:
      return null;
  }
}

// ── cleaning ──────────────────────────────────────────────────────────────
const titleCase = (s: string) => s.toLowerCase().replace(/(^|[\s(/-])([a-z])/g, (_m, p: string, c: string) => p + c.toUpperCase());

export function cleanName(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let s = raw.replace(/\s+/g, ' ').trim();
  if (!s) return null;
  if (s.length > 6 && s === s.toUpperCase() && /[A-Z]{4}/.test(s)) s = titleCase(s); // ALL CAPS → Title Case
  return s.slice(0, 160);
}

export const normName = (s: string | null | undefined) =>
  (s ?? '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9 ]/g, ' ').replace(/\b(restoran|kedai|makan|cafe|kafe|masjid|surau|klinik|farmasi|hotel|the|sdn|bhd)\b/g, ' ').replace(/\s+/g, ' ').trim();

/** Malaysian number as +60…, or 'invalid'. */
export function cleanPhone(p: string | null | undefined): string | null | 'invalid' {
  if (!p) return null;
  const d = p.split(/[;,]/)[0].replace(/[^\d+]/g, '');
  const m = d.replace(/^\+?60/, '0');
  return /^0\d{8,10}$/.test(m) ? `+60${m.slice(1)}` : 'invalid';
}

const address = (t: Record<string, string>) => [t['addr:housenumber'], t['addr:street'], t['addr:city'] ?? t['addr:place'], t['addr:postcode']].filter(Boolean).join(', ').slice(0, 300) || null;

/** Tags kept with a record (design §4.5); everything else is dropped. */
const KEEP = new Set(['amenity', 'shop', 'tourism', 'leisure', 'historic', 'healthcare', 'religion', 'cuisine', 'brand', 'branch', 'operator', 'opening_hours', 'check_date', 'drive_through', 'takeaway', 'internet_access', 'wheelchair', 'building', 'natural']);
export const keptTags = (t: Record<string, string>) => Object.fromEntries(Object.entries(t).filter(([k]) => KEEP.has(k) || k.startsWith('addr:')).map(([k, v]) => [k, String(v).slice(0, 200)]));

// ── rules ─────────────────────────────────────────────────────────────────
const GENERIC = /^(kedai|restoran|restaurant|masjid|surau|musolla|klinik|farmasi|shop|cafe|kafe|hotel|kantin|canteen|warung|bengkel|pasar|stesen minyak|homestay|chalet)$/i;
/** Names that suggest the category may be wrong (audit: "EcoWorld Gallery" as a park, "Alat Ganti Lori" as a workshop) */
const DOUBTFUL = /\b(gallery|galeri|sales|jualan|showroom|alat ganti|spare ?parts?|hardware|pejabat|office)\b/i;
const STALE_YEARS = 5;

export function isStale(lastEdit: string | null, tags: Record<string, string>, now: Date): boolean {
  if (!lastEdit || tags.check_date) return false;
  const t = Date.parse(lastEdit);
  return Number.isFinite(t) && now.getTime() - t > STALE_YEARS * 365.25 * 86_400_000;
}

/** Apply the import rules to one OSM object. null = not one of the 8 categories. */
export function classify(f: OsmFeature, now = new Date()): StagingRow | null {
  const t = f.tags;
  const cats = categoriesOf(t);
  if (!cats.length) return null;
  const category = cats[0];
  const brand = t.brand?.trim() || null;
  const branch = t.branch?.trim() || null;
  let name = cleanName(t.name);
  const issues: string[] = [];
  // Fuel stations: "brand + branch" when OSM only has the brand (audit: "BHPetrol Seri Cheeding")
  if (category === 'minyak' && brand && (!name || name.toLowerCase() === brand.toLowerCase())) {
    if (branch) name = cleanName(`${brand} ${branch}`);
    else {
      name = name ?? brand;
      issues.push('nama_jenama_sahaja');
    }
  }
  const phone = cleanPhone(t.phone ?? t['contact:phone']);
  const addr = address(t);
  if (!name) issues.push('nama_kosong');
  else if (name.length < 3) issues.push('nama_terlalu_pendek');
  if (name && GENERIC.test(name)) issues.push('nama_generik');
  if (cats.length > 1) issues.push('pelbagai_kategori');
  if (phone === 'invalid') issues.push('telefon_tidak_sah');
  if (t.healthcare === 'alternative' || (name && DOUBTFUL.test(name))) issues.push('kategori_meragukan');
  if (f.inside_institution) issues.push('institusi');
  if (!f.inside_boundary) issues.push('luar_kawasan');
  if (isStale(f.last_edit, t, now)) issues.push('data_lapuk');

  // data_lapuk and nama_jenama_sahaja are notes, not faults: they don't block approval
  const NOTES = new Set(['data_lapuk', 'nama_jenama_sahaja']);
  const faults = issues.filter((i) => !NOTES.has(i));
  const quality = Math.min(100,
    (name ? 30 : 0) + (cats.length === 1 ? 20 : 0) + (addr ? 15 : 0) + (phone && phone !== 'invalid' ? 10 : 0) + (t.opening_hours ? 10 : 0) + (brand ? 5 : 0) + (faults.length === 0 ? 10 : 0));

  let decision: ImportDecision;
  let reject_reason: string | null = null;
  if (!f.inside_boundary) [decision, reject_reason] = ['rejected', 'luar_kawasan'];
  else if (f.inside_institution) [decision, reject_reason] = ['rejected', 'institusi'];
  else if (!name) [decision, reject_reason] = ['rejected', 'nama_kosong'];
  else if (faults.length === 0 && quality >= 60) decision = 'auto_approved';
  else decision = 'needs_review';

  return {
    osm_ref: f.osm_ref,
    osm_version: f.version,
    osm_last_edit: f.last_edit,
    name,
    category,
    subcategory: subcategoryOf(category, t, name),
    brand: brand?.slice(0, 80) ?? null,
    branch: branch?.slice(0, 80) ?? null,
    lat: Math.round(f.lat * 1e6) / 1e6,
    lng: Math.round(f.lng * 1e6) / 1e6,
    address: addr,
    phone: phone === 'invalid' ? null : phone,
    website: (t.website ?? t['contact:website'] ?? null)?.slice(0, 300) ?? null,
    opening_hours: t.opening_hours?.slice(0, 200) ?? null,
    tags: keptTags(t),
    settlement_class: f.inside_boundary ? settlementClass(f.place_tag) : 'luar',
    osm_place_tag: f.place_tag && /^[a-z_]{2,30}$/.test(f.place_tag) ? f.place_tag : null,
    nearest_place: f.nearest_place?.slice(0, 120) ?? null,
    coastal: f.coastal,
    inside_institution: f.inside_institution?.slice(0, 160) ?? null,
    issues,
    quality,
    decision,
    reject_reason,
  };
}

const metres = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) =>
  Math.hypot((a.lng - b.lng) * 111320 * Math.cos((a.lat * Math.PI) / 180), (a.lat - b.lat) * 110574);

/**
 * Duplicates: same normalised name and category within 50 m. Branches of a chain
 * are not duplicates (different `branch`, or further apart: 99 Speedmart, Watsons).
 * The better record stays; the other becomes 'duplicate'. Rejected rows are ignored.
 */
export function markDuplicates(rows: StagingRow[]): StagingRow[] {
  const out = rows.map((r) => ({ ...r, issues: [...r.issues] }));
  const live = out.filter((r) => r.decision !== 'rejected' && r.name);
  for (let i = 0; i < live.length; i++) {
    const a = live[i];
    if (a.decision === 'duplicate') continue;
    for (let j = i + 1; j < live.length; j++) {
      const b = live[j];
      if (b.decision === 'duplicate' || a.category !== b.category) continue;
      if (!normName(a.name) || normName(a.name) !== normName(b.name)) continue;
      if (a.branch && b.branch && a.branch.toLowerCase() !== b.branch.toLowerCase()) continue;
      if (metres(a, b) > 50) continue;
      const [keep, drop] = b.quality > a.quality ? [b, a] : [a, b];
      drop.decision = 'duplicate';
      if (!drop.issues.includes('pendua')) drop.issues.push('pendua');
      if (keep === b) break; // a is now the duplicate
    }
  }
  return out;
}

/** Whole pipeline for one run: classify every object, then mark duplicates. */
export function buildStaging(features: OsmFeature[], now = new Date()): StagingRow[] {
  const seen = new Set<string>();
  const rows: StagingRow[] = [];
  for (const f of features) {
    if (seen.has(f.osm_ref)) continue; // one record per OSM object
    seen.add(f.osm_ref);
    const r = classify(f, now);
    if (r) rows.push(r);
  }
  return markDuplicates(rows);
}
