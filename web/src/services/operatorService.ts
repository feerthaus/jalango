import { supabase } from '@/lib/supabase';
import { preparePhoto } from './accidentService';
import { toReportError } from './reportsService';

export type OperatorKind = 'homestay' | 'car_rental';
export type OperatorStatus = 'pending' | 'needs_info' | 'approved' | 'rejected' | 'suspended';
export type DocKind = 'ic' | 'ownership' | 'ssm' | 'apad_licence' | 'insurance' | 'other';

export interface Operator {
  id: string;
  user_id: string;
  kind: OperatorKind;
  business_name: string;
  state: string;
  town: string;
  phone: string;
  description: string | null;
  ssm_no: string | null;
  apad_licence_no: string | null;
  apad_expires_on: string | null;
  insurance_expires_on: string | null;
  /** set when a car rental operator without an APAD licence accepted the disclaimer */
  licence_disclaimer_at: string | null;
  status: OperatorStatus;
  review_note: string | null;
  reviewed_at: string | null;
  approved_at: string | null;
  free_until: string | null;
  created_at: string;
  updated_at: string;
}

export interface OperatorDocument {
  id: string;
  operator_id: string;
  kind: DocKind;
  path: string;
  created_at: string;
}

export type OperatorInput = Pick<Operator, 'kind' | 'business_name' | 'state' | 'town' | 'phone' | 'description' | 'ssm_no' | 'apad_licence_no' | 'apad_expires_on' | 'insurance_expires_on' | 'licence_disclaimer_at'>;

export const DOCS_BUCKET = 'operator-docs';
const COLS = 'id,user_id,kind,business_name,state,town,phone,description,ssm_no,apad_licence_no,apad_expires_on,insurance_expires_on,licence_disclaimer_at,status,review_note,reviewed_at,approved_at,free_until,created_at,updated_at';

/** Documents an operator must upload before review (APAD licence and insurance only if given). */
export function requiredDocs(o: Pick<Operator, 'kind' | 'apad_licence_no' | 'insurance_expires_on'>): DocKind[] {
  if (o.kind === 'homestay') return ['ic', 'ownership'];
  return ['ssm', ...(o.apad_licence_no ? (['apad_licence'] as DocKind[]) : []), ...(o.insurance_expires_on ? (['insurance'] as DocKind[]) : [])];
}

/** Licensed car rental: has an APAD licence that is still valid. */
export const isApadLicensed = (o: Pick<Operator, 'kind' | 'apad_licence_no' | 'apad_expires_on'>, today = new Date().toISOString().slice(0, 10)) =>
  o.kind === 'car_rental' && Boolean(o.apad_licence_no) && (o.apad_expires_on ?? '') > today;

function client() {
  if (!supabase) throw new Error('Not connected.');
  return supabase;
}

export async function fetchMyOperator(userId: string): Promise<{ operator: Operator | null; docs: OperatorDocument[] }> {
  const { data, error } = await client().from('operators').select(COLS).eq('user_id', userId).maybeSingle();
  if (error) throw toReportError(error);
  if (!data) return { operator: null, docs: [] };
  const { data: docs } = await client().from('operator_documents').select('id,operator_id,kind,path,created_at').eq('operator_id', data.id).order('created_at');
  return { operator: data as Operator, docs: (docs ?? []) as OperatorDocument[] };
}

/** Create or update the signed-in user's business. Any change sends it (back) to review. */
export async function saveOperator(userId: string, input: OperatorInput, existingId?: string): Promise<Operator> {
  const row = { ...input, user_id: userId };
  const q = existingId ? client().from('operators').update(row).eq('id', existingId) : client().from('operators').insert(row);
  const { data, error } = await q.select(COLS).single();
  if (error) throw toReportError(error);
  return data as Operator;
}

/** Upload a verification document (photo shrunk + EXIF removed; PDFs as they are). */
export async function uploadOperatorDoc(userId: string, operatorId: string, kind: DocKind, file: File): Promise<OperatorDocument> {
  const pdf = file.type === 'application/pdf';
  if (pdf && file.size > 5 * 1024 * 1024) throw new Error('Fail PDF melebihi 5 MB.');
  const body: Blob = pdf ? file : await preparePhoto(file, 1600);
  const path = `${userId}/${crypto.randomUUID()}.${pdf ? 'pdf' : 'jpg'}`;
  const up = await client().storage.from(DOCS_BUCKET).upload(path, body, { contentType: pdf ? 'application/pdf' : 'image/jpeg', upsert: false });
  if (up.error) throw new Error(up.error.message);
  const { data, error } = await client().from('operator_documents').insert({ operator_id: operatorId, user_id: userId, kind, path }).select('id,operator_id,kind,path,created_at').single();
  if (error) {
    await client().storage.from(DOCS_BUCKET).remove([path]);
    throw toReportError(error);
  }
  return data as OperatorDocument;
}

export async function deleteOperatorDoc(doc: OperatorDocument): Promise<void> {
  const { error } = await client().from('operator_documents').delete().eq('id', doc.id);
  if (error) throw toReportError(error);
  await client().storage.from(DOCS_BUCKET).remove([doc.path]);
}

export async function docUrls(paths: string[]): Promise<Record<string, string>> {
  if (paths.length === 0) return {};
  const { data, error } = await client().storage.from(DOCS_BUCKET).createSignedUrls(paths, 600);
  if (error || !data) return {};
  return Object.fromEntries(data.flatMap((d) => (d.signedUrl && d.path ? [[d.path, d.signedUrl] as const] : [])));
}

/* ─── admin ─── */
export interface OperatorWithDocs extends Operator {
  documents: OperatorDocument[];
}

export async function fetchOperatorsForReview(): Promise<OperatorWithDocs[]> {
  const { data, error } = await client()
    .from('operators')
    .select(`${COLS},documents:operator_documents(id,operator_id,kind,path,created_at)`)
    .order('updated_at', { ascending: false })
    .limit(200);
  if (error) throw toReportError(error);
  return (data ?? []) as OperatorWithDocs[];
}

export async function reviewOperator(id: string, decision: 'approved' | 'needs_info' | 'rejected' | 'suspended', note?: string): Promise<void> {
  const { error } = await client().rpc('admin_review_operator', { p_operator: id, p_decision: decision, p_note: note ?? null });
  if (error) throw toReportError(error);
}
