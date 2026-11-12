import { supabase } from '@/lib/supabase';

/** Is this account an admin, and has this session passed two-factor (aal2)? Decided by the database. */
export interface AdminStatus {
  admin: boolean;
  twoFactor: boolean;
}

export async function fetchAdminStatus(): Promise<AdminStatus> {
  if (!supabase) return { admin: false, twoFactor: false };
  const { data, error } = await supabase.rpc('admin_status');
  if (error || !data) return { admin: false, twoFactor: false };
  const d = data as { admin?: boolean; aal?: string };
  return { admin: Boolean(d.admin), twoFactor: d.aal === 'aal2' };
}

function auth() {
  if (!supabase) throw new Error('Not connected.');
  return supabase.auth;
}

/** The verified authenticator app of this account, if any. */
export async function verifiedTotpFactor(): Promise<{ id: string } | null> {
  const { data, error } = await auth().mfa.listFactors();
  if (error) throw new Error(error.message);
  return data.totp[0] ?? null;
}

export interface Enrollment {
  factorId: string;
  qr: string;
  secret: string;
}

/** Start setting up an authenticator app: returns the QR code to scan. Unfinished earlier attempts are cleared first. */
export async function startEnrollment(): Promise<Enrollment> {
  const a = auth();
  const { data: list } = await a.mfa.listFactors();
  for (const f of list?.all ?? []) {
    if (f.factor_type === 'totp' && f.status !== 'verified') await a.mfa.unenroll({ factorId: f.id });
  }
  const { data, error } = await a.mfa.enroll({ factorType: 'totp', friendlyName: `JalanGo Admin ${new Date().toISOString().slice(0, 10)}`, issuer: 'JalanGo' });
  if (error) throw new Error(error.message);
  return { factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret };
}

/** Check a 6-digit code; on success the session is upgraded to two-factor (aal2). */
export async function verifyCode(factorId: string, code: string): Promise<void> {
  const { error } = await auth().mfa.challengeAndVerify({ factorId, code: code.replace(/\s/g, '') });
  if (error) throw new Error(error.message);
}
