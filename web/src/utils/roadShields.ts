export type ShieldKind = 'expressway' | 'federal' | 'state' | 'other';

export interface Shield {
  text: string;
  kind: ShieldKind;
}

/**
 * Split a road reference into sign-style shields: "E1;E2; E6" → E1, E2, E6.
 * Malaysian expressways are "E…", federal routes are numbers ("FT 2" → "2"),
 * state routes start with the state letter (e.g. "J200", "B23").
 */
export function parseShields(ref: string | undefined): Shield[] {
  if (!ref) return [];
  const seen = new Set<string>();
  const out: Shield[] = [];
  for (const raw of ref.split(/[;,/]/)) {
    let text = raw.trim().toUpperCase().replace(/\s+/g, ' ');
    if (!text) continue;
    let kind: ShieldKind = 'other';
    if (/^E\s?\d{1,3}[A-Z]?$/.test(text)) {
      kind = 'expressway';
      text = text.replace(/\s/g, '');
    } else if (/^(FT\s?)?\d{1,4}[A-Z]?$/.test(text)) {
      kind = 'federal';
      text = text.replace(/^FT\s?/, '');
    } else if (/^[A-Z]\s?\d{1,4}[A-Z]?$/.test(text)) {
      kind = 'state';
      text = text.replace(/\s/g, '');
    }
    if (seen.has(text)) continue;
    seen.add(text);
    out.push({ text, kind });
    if (out.length >= 4) break;
  }
  return out;
}
