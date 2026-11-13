/**
 * "Sign in with Google" on our own page (Google Identity Services), so Google
 * shows the JalanGo site instead of the Supabase project address. The ID token
 * is handed to Supabase with signInWithIdToken. Falls back to the redirect flow
 * when no client ID is configured or the Google script cannot load.
 */
export const GOOGLE_CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined)?.trim() || '';

interface CredentialResponse {
  credential: string;
}
interface GoogleId {
  initialize: (o: Record<string, unknown>) => void;
  renderButton: (el: HTMLElement, o: Record<string, unknown>) => void;
  cancel: () => void;
}
declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleId } };
  }
}

let loading: Promise<GoogleId> | null = null;

export function loadGoogleIdentity(): Promise<GoogleId> {
  if (window.google?.accounts?.id) return Promise.resolve(window.google.accounts.id);
  loading ??= new Promise<GoogleId>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = () => (window.google?.accounts?.id ? resolve(window.google.accounts.id) : reject(new Error('Google tidak dapat dimuatkan.')));
    s.onerror = () => {
      loading = null;
      reject(new Error('Google tidak dapat dimuatkan.'));
    };
    document.head.appendChild(s);
  });
  return loading;
}

/** Random nonce: the raw value goes to Supabase, its SHA-256 (hex) to Google. */
export async function makeNonce(): Promise<{ raw: string; hashed: string }> {
  const raw = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))));
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
  const hashed = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
  return { raw, hashed };
}

/**
 * Render Google's official button into `el`. Calls onToken with the ID token
 * and the raw nonce when the person picks an account.
 */
export async function renderGoogleButton(el: HTMLElement, onToken: (token: string, nonce: string) => void, width: number, isAlive: () => boolean = () => true): Promise<void> {
  const gid = await loadGoogleIdentity();
  const { raw, hashed } = await makeNonce();
  if (!isAlive()) return;
  el.replaceChildren();
  gid.initialize({
    client_id: GOOGLE_CLIENT_ID,
    nonce: hashed,
    ux_mode: 'popup',
    use_fedcm_for_prompt: true,
    itp_support: true,
    callback: (r: CredentialResponse) => onToken(r.credential, raw),
  });
  gid.renderButton(el, { type: 'standard', theme: 'outline', size: 'large', shape: 'pill', text: 'continue_with', locale: 'ms', width: Math.max(200, Math.min(400, Math.round(width))) });
}
