import { IS_ADMIN_PREVIEW } from '../admin/preview';
/* ==========================================================================
   Service « Back office » — authentification (jeton Sanctum) et appels
   protégés vers l'API Laravel. Le jeton vit en localStorage ; toutes les
   requêtes partent avec Authorization: Bearer + Accept: application/json.
   ========================================================================== */

const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api/v1';
const TOKEN_KEY = 'caimmo.admin.token';
// L'iframe d'aperçu peut refuser localStorage. Le jeton fictif reste uniquement
// en mémoire ; le stockage et l'authentification réels ne sont pas modifiés.
let previewToken: string | null = null;
let previewSessionPending: Promise<void> | null = null;

export function getToken(): string | null {
  if (IS_ADMIN_PREVIEW) return previewToken;
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function setToken(token: string | null) {
  if (IS_ADMIN_PREVIEW) { previewToken = token; return; }
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* stockage indisponible */
  }
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/** Accès automatique exclusivement au mock Vite opt-in, jamais à Laravel. */
export function ensurePreviewSession(force = false): Promise<void> {
  if (!IS_ADMIN_PREVIEW) return Promise.reject(new Error('Accès automatique réservé à l’aperçu isolé.'));
  if (previewSessionPending) return previewSessionPending;
  if (previewToken && !force) return Promise.resolve();
  previewSessionPending = (async () => {
    const res = await fetch(`${BASE}/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ email: 'validation@caimmo.example', password: 'apercu-ca-immo' }),
    });
    if (!res.ok) throw new ApiError('Impossible d’ouvrir l’aperçu. Réessayez.', res.status);
    const session = await res.json() as { token?: string };
    if (!session.token?.startsWith('preview-')) throw new ApiError('Session d’aperçu invalide.', 502);
    setToken(session.token);
  })().finally(() => { previewSessionPending = null; });
  return previewSessionPending;
}

/** Le renouvellement après un redémarrage du mock est borné à une tentative. */
async function fetchWithPreviewSession(url: string, init: RequestInit, protectedRoute = true): Promise<Response> {
  if (!IS_ADMIN_PREVIEW || !protectedRoute) return fetch(url, init);
  await ensurePreviewSession();
  const send = () => {
    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${getToken()}`);
    return fetch(url, { ...init, headers });
  };
  let response = await send();
  if (response.status === 401) {
    await ensurePreviewSession(true);
    response = await send();
  }
  return response;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  let res: Response;
  try {
    res = await fetchWithPreviewSession(`${BASE}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init?.headers ?? {}),
      },
    }, path !== '/admin/login');
  } catch {
    throw new ApiError('Impossible de joindre le serveur.', 0);
  }

  if (res.status === 401) {
    setToken(null); // jeton expiré ou révoqué : on repart sur l'écran de connexion
    // Exception : /admin/login renvoie aussi 401 pour un mot de passe erroné —
    // ce n'est pas une session qui expire, il n'y en a pas encore. On relaie
    // alors le vrai message de l'API (« Identifiants incorrects. ») plutôt que
    // d'afficher « Session expirée » qui n'a aucun sens avant la 1ère connexion.
    if (path !== '/admin/login') {
      throw new ApiError('Session expirée — reconnectez-vous.', 401);
    }
  }

  if (!res.ok) {
    let message = `Erreur ${res.status}.`;
    try {
      const body = (await res.json()) as { message?: string };
      if (body?.message) message = body.message;
    } catch {
      /* corps non JSON */
    }
    throw new ApiError(message, res.status);
  }

  return (await res.json()) as T;
}

/* ---------- Authentification ---------- */

export interface AdminUser {
  id: string;
  name: string;
  email: string;
}

export async function login(
  email: string,
  password: string,
): Promise<AdminUser> {
  const res = await request<{ token: string; user: AdminUser }>(
    '/admin/login',
    {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    },
  );
  setToken(res.token);
  return res.user;
}

export async function logout(): Promise<void> {
  try {
    await request('/admin/logout', { method: 'POST' });
  } catch {
    /* même en cas d'échec réseau, on oublie le jeton localement */
  }
  setToken(null);
}

export function isLoggedIn(): boolean {
  return getToken() !== null;
}

/* ---------- Chargement initial (toutes les collections du back office) ---------- */

export interface Bootstrap {
  lands: unknown[];
  requests: unknown[];
  clients: unknown[];
  searches: unknown[];
  landFiles: unknown[];
  realisations: unknown[];
  messages: unknown[];
}

export function bootstrap(): Promise<Bootstrap> {
  return request<Bootstrap>('/admin/bootstrap');
}

/* ---------- Sauvegardes (upsert : POST si nouveau, PUT sinon) ---------- */

async function upsert<T extends { id: string }>(
  resource: string,
  item: T,
): Promise<T> {
  const known = /^\d+$/.test(item.id); // ids serveur = numériques
  return request<T>(
    known ? `/admin/${resource}/${item.id}` : `/admin/${resource}`,
    {
      method: known ? 'PUT' : 'POST',
      body: JSON.stringify(item),
    },
  );
}

// Le type exact est garanti par l'appelant (cache synchronisé) ; ici on ne
// transporte que la forme minimale dont l'upsert a besoin.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = { id: string } & Record<string, any>;
export const saveRequestApi = (r: AnyRecord) => upsert('requests', r);
export const saveClientApi = (c: AnyRecord) => upsert('clients', c);
export const saveSearchApi = (s: AnyRecord) => upsert('searches', s);
export const saveLandFileApi = (f: AnyRecord) => upsert('land-files', f);
export const saveRealisationApi = (r: AnyRecord) => upsert('realisations', r);
export const saveLandApi = (l: AnyRecord) => upsert('lands', l);

export async function deleteApi(resource: string, id: string): Promise<void> {
  await request(`/admin/${resource}/${id}`, { method: 'DELETE' });
}

/* ---------- Messages ---------- */

export async function updateMessageApi(
  id: string,
  patch: { status?: string; read?: boolean },
): Promise<void> {
  await request(`/admin/messages/${id}`, {
    method: 'PUT',
    body: JSON.stringify(patch),
  });
}

/* ---------- Catalogue : réinitialisation de la démo ---------- */

export async function resetLandsApi(): Promise<{
  message: string;
  lands?: unknown[];
}> {
  return request('/admin/lands/reset', { method: 'POST' });
}

/* ---------- Fichiers (photos, pièces jointes) ---------- */

export interface UploadedFile {
  id: string;
  name: string;
  type: string;
  size: number;
  url: string;
}

export async function fetchProtectedFile(url: string): Promise<Blob> {
  const isProtected = url.startsWith('/api/v1/admin/files/');
  const token = isProtected ? getToken() : null;
  const res = await fetchWithPreviewSession(url, {
    headers: {
      Accept: '*/*',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  }, isProtected);
  if (isProtected && (res.status === 401 || res.status === 403)) {
    setToken(null);
    throw new ApiError('Session expirée — reconnectez-vous.', res.status);
  }
  if (!res.ok)
    throw new ApiError(`Fichier indisponible (${res.status}).`, res.status);
  return res.blob();
}

export async function uploadFile(
  file: File,
  visibility: 'public' | 'private' = 'private',
): Promise<UploadedFile> {
  const token = getToken();
  const form = new FormData();
  form.append('file', file);
  form.append('visibility', visibility);

  const res = await fetchWithPreviewSession(`${BASE}/admin/uploads`, {
    method: 'POST',
    body: form,
    headers: {
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) {
    let message = `Dépôt impossible (${res.status}).`;
    try {
      const body = (await res.json()) as { message?: string };
      if (body?.message) message = body.message;
    } catch {
      /* ignore */
    }
    throw new ApiError(message, res.status);
  }
  return (await res.json()) as UploadedFile;
}

/** Restaurer seulement le serveur mock opt-in ; jamais l'API réelle. */
export async function restorePreviewApi(): Promise<void> {
  if (!IS_ADMIN_PREVIEW)
    throw new Error('Cette opération est réservée à l’aperçu isolé.');
  await request('/admin/preview/reset', { method: 'POST' });
}
