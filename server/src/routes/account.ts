import { Router, type Request } from 'express';
import { z } from 'zod';
import { HttpError } from '../lib/errors.js';
import { supabaseAdmin } from '../lib/supabaseAdmin.js';

/** Resolve the signed-in user from the Supabase access token in the Authorization header. */
export async function userFromRequest(req: Request): Promise<{ id: string; email?: string } | null> {
  const header = req.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token || !supabaseAdmin) return null;
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) return null;
  return { id: data.user.id, email: data.user.email ?? undefined };
}

function requireAdminClient() {
  if (!supabaseAdmin) throw new HttpError(503, 'not_configured', 'Accounts are not configured on the server');
  return supabaseAdmin;
}

export const accountRouter = Router();

/**
 * Permanently delete the caller's account. Deleting the auth user cascades
 * to public.users and every row that references it (reports, votes, trips,
 * shortcuts, places, flags…). Feedback is kept but unlinked.
 */
accountRouter.post('/delete', async (req, res) => {
  const admin = requireAdminClient();
  const user = await userFromRequest(req);
  if (!user) throw new HttpError(401, 'unauthorized', 'Please sign in again to delete your account');
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) {
    console.error('[jalango] account delete failed', error.message);
    throw new HttpError(502, 'delete_failed', 'Could not delete the account. Please try again.');
  }
  res.json({ deleted: true });
});

export const feedbackSchema = z.object({
  category: z.enum(['bug', 'idea', 'map_data', 'other']),
  message: z.string().trim().min(3).max(2000),
  contact: z.string().trim().max(120).optional(),
  page: z.string().trim().max(200).optional(),
});

export const feedbackRouter = Router();

/** In-app feedback; works for guests too (IP rate-limited). */
feedbackRouter.post('/', async (req, res) => {
  const admin = requireAdminClient();
  const body = feedbackSchema.parse(req.body);
  const user = await userFromRequest(req);
  const { error } = await admin.from('feedback').insert({
    user_id: user?.id ?? null,
    category: body.category,
    message: body.message,
    contact: body.contact || user?.email || null,
    page: body.page || null,
    user_agent: (req.get('user-agent') ?? '').slice(0, 300) || null,
  });
  if (error) {
    console.error('[jalango] feedback insert failed', error.message);
    throw new HttpError(502, 'storage_error', 'Could not send feedback');
  }
  res.status(201).json({ ok: true });
});
