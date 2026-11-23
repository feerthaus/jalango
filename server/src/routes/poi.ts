import { createHash, timingSafeEqual } from 'node:crypto';
import express, { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import { config } from '../config.js';
import { HttpError } from '../lib/errors.js';
import { supabaseAdmin } from '../lib/supabaseAdmin.js';
import { POI_CATEGORIES } from '../poi/rules.js';

/**
 * POI import (POI-2B). Only the import workflow in GitHub Actions calls this,
 * with its own token (POI_INGEST_TOKEN, not the service-role key). Off unless
 * POI_IMPORT_ENABLED=true. The database functions it calls hold the rules that
 * matter (run held when it would hide > 5 %, rollback, admin review).
 */
export const poiRouter = Router();

const sha = (s: string) => createHash('sha256').update(s).digest();
export function tokenMatches(given: string | undefined, expected: string | null): boolean {
  if (!given || !expected || expected.length < 32) return false;
  return timingSafeEqual(sha(given), sha(expected));
}

export const requireIngest: RequestHandler = (req, _res, next) => {
  if (!config.poiImportEnabled) return next(new HttpError(503, 'poi_import_disabled', 'POI import is switched off.'));
  if (!supabaseAdmin) return next(new HttpError(503, 'supabase_not_configured', 'Database not configured.'));
  const auth = req.header('authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : undefined;
  if (!tokenMatches(token, config.poiIngestToken)) return next(new HttpError(401, 'unauthorized', 'Invalid token.'));
  next();
};

export const startSchema = z.object({
  region: z.literal('kuala-langat'),
  extract_url: z.string().url().max(300).startsWith('https://download.geofabrik.de/'),
  extract_md5: z.string().regex(/^[0-9a-f]{32}$/),
  extract_timestamp: z.string().datetime({ offset: true }),
});

const text = (max: number) => z.string().max(max).nullable();
export const rowSchema = z.object({
  osm_ref: z.string().regex(/^(node|way|relation)\/\d{1,15}$/),
  osm_version: z.number().int().nonnegative().nullable(),
  osm_last_edit: z.string().datetime({ offset: true }).nullable(),
  name: text(160),
  category: z.enum(POI_CATEGORIES),
  subcategory: text(60),
  brand: text(80),
  branch: text(80),
  lat: z.number().min(0.5).max(7.6),
  lng: z.number().min(99.4).max(119.5),
  address: text(300),
  phone: z.string().regex(/^\+60\d{8,10}$/).nullable(),
  website: text(300),
  opening_hours: text(200),
  tags: z.record(z.string().max(80), z.string().max(200)).refine((t) => Object.keys(t).length <= 40, 'too many tags'),
  settlement_class: z.enum(['bandar', 'pekan', 'kampung', 'penempatan_kecil', 'luar']).nullable(),
  osm_place_tag: z.string().regex(/^[a-z_]{2,30}$/).nullable(),
  nearest_place: text(120),
  coastal: z.boolean(),
  inside_institution: text(160),
  issues: z.array(z.string().regex(/^[a-z_]{2,40}$/)).max(12),
  quality: z.number().int().min(0).max(100),
  decision: z.enum(['auto_approved', 'needs_review', 'rejected', 'duplicate']),
  reject_reason: text(200),
});
export const rowsSchema = z.object({ rows: z.array(rowSchema).min(1).max(500) });
const runId = z.string().uuid();

// Token first, then the body (batches are bigger than the API's default 32 kB limit)
poiRouter.use(requireIngest);
poiRouter.use(express.json({ limit: '1mb' }));

poiRouter.post('/runs', async (req, res) => {
  const b = startSchema.parse(req.body);
  const { data, error } = await supabaseAdmin!.rpc('poi_start_run', {
    p_region: b.region, p_extract_url: b.extract_url, p_extract_md5: b.extract_md5, p_extract_timestamp: b.extract_timestamp,
  });
  if (error) throw new HttpError(409, 'poi_run_not_started', error.message);
  res.status(201).json({ run: data });
});

poiRouter.post('/runs/:id/rows', async (req, res) => {
  const id = runId.parse(req.params.id);
  const { rows } = rowsSchema.parse(req.body);
  const { data, error } = await supabaseAdmin!.rpc('poi_ingest', { p_run: id, p_rows: rows });
  if (error) throw new HttpError(409, 'poi_ingest_failed', error.message);
  res.json({ staged: data });
});

poiRouter.post('/runs/:id/process', async (req, res) => {
  const id = runId.parse(req.params.id);
  const { data, error } = await supabaseAdmin!.rpc('poi_process_run', { p_run: id, p_force: false });
  if (error) throw new HttpError(409, 'poi_process_failed', error.message);
  res.json({ result: data });
});
