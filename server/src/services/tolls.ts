import type { TollPoint } from '../types.js';

/**
 * Toll fares (phase B): the exact class 1 (car) fare for a route from the toll
 * plazas it passes, when every plaza on it is in the official table below.
 * Otherwise the app keeps the "~RM" estimate (phase A).
 *
 * Two kinds of plaza:
 *  - open system: a fixed fare at that plaza (most Klang Valley expressways)
 *  - closed system: you take a ticket / tap in at the entry plaza and pay at
 *    the exit plaza by the pair (PLUS North–South, ELITE, LEKAS…)
 *
 * Only add rates taken from an official source (LLM / the concessionaire),
 * with that source and date. Unverified rates must not go in: a "Tol RM12.87"
 * without "~" tells drivers it's exact.
 */

export interface TollTable {
  /** when the rates were checked against the official source */
  asOf: string;
  source: string;
  /** open-system plazas: normalised plaza name → RM (class 1) */
  open: Record<string, number>;
  /** closed systems: name → plazas in it and the fares between them ("a|b", either order) */
  closed: Record<string, { plazas: string[]; fares: Record<string, number> }>;
}

/**
 * Official class 1 rates. Empty until the owner supplies the official tables
 * (the LLM and PLUS sites can't be read from the build machine): fill in from
 * LLM / PLUS, keeping `asOf` and `source` up to date.
 */
export const TOLL_TABLE: TollTable = {
  asOf: '',
  source: '',
  open: {},
  closed: {},
};

/** "Plaza Tol Sunway (Arah Timur)" → "sunway". */
export function plazaKey(name: string | undefined): string | null {
  if (!name) return null;
  const k = name
    .toLowerCase()
    .replace(/\(.*?\)/g, ' ')
    .replace(/\b(plaza\s+tol|plaza|tol|toll\s+plaza|toll)\b/g, ' ')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return k || null;
}

const pairKey = (a: string, b: string) => [a, b].sort().join('|');

export interface TollFare {
  /** RM, class 1; only when every toll plaza on the route is in the table */
  total: number | null;
  /** plazas (or closed-system trips) priced */
  priced: number;
  /** plaza names we have no fare for */
  unknown: string[];
}

/**
 * Price a route's toll plazas, in order. A closed-system trip runs from its
 * first plaza on the route to the next plaza of the same system.
 */
export function priceTolls(points: TollPoint[] | undefined, table: TollTable = TOLL_TABLE): TollFare {
  const booths = (points ?? []).filter((p) => p.type === 'booth' || p.type === 'gantry');
  if (!booths.length) return { total: null, priced: 0, unknown: [] };
  const systemOf = (k: string) => Object.entries(table.closed).find(([, sys]) => sys.plazas.includes(k))?.[0] ?? null;
  let total = 0;
  let priced = 0;
  const unknown: string[] = [];
  let open: { system: string; entry: string } | null = null;
  let previous: string | null = null;
  for (const p of booths) {
    const k = plazaKey(p.name);
    if (!k) {
      unknown.push(p.name ?? '(no name)');
      continue;
    }
    if (k === previous) continue; // the router sometimes lists the same plaza twice
    previous = k;
    if (table.open[k] !== undefined) {
      total += table.open[k];
      priced += 1;
      continue;
    }
    const sys = systemOf(k);
    if (!sys) {
      unknown.push(p.name ?? k);
      continue;
    }
    if (!open || open.system !== sys) {
      if (open) unknown.push(`${open.entry} → ?`); // left a closed system without its exit plaza
      open = { system: sys, entry: k };
      continue;
    }
    const fare = table.closed[sys].fares[pairKey(open.entry, k)];
    if (fare === undefined) unknown.push(`${open.entry} → ${k}`);
    else {
      total += fare;
      priced += 1;
    }
    open = null;
  }
  if (open) unknown.push(`${open.entry} → ?`);
  return { total: unknown.length === 0 && priced > 0 ? Math.round(total * 100) / 100 : null, priced, unknown };
}
