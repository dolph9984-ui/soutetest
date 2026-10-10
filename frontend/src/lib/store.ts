/* ==========================================================================
   Noyau partagé site + back office.
   TERRAINS & MESSAGES : cache hydraté depuis l'API Laravel (l'admin appelle
   hydrate au login ; le site public lit via services/landService).
   AUTHENTIFICATION : jeton Sanctum délivré par l'API (services/adminService).
   ========================================================================== */

import { ContactMessage, Land } from '../types';

export type {
  ContactMessage,
  ContactPayload,
  RequestStatus,
  Reservation,
  ReservationPayload,
} from '../types';

import {
  cache,
  removeSync,
  replaceSync,
  upsertSync,
  warnSyncFailed,
} from '../admin/crm/sync';
import {
  ApiError,
  login as apiLogin,
  logout as apiLogout,
  deleteApi,
  isLoggedIn,
  resetLandsApi,
  saveLandApi,
  updateMessageApi,
} from '../services/adminService';

export function newId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

// --- Terrains (catalogue partagé site public / back office) ---

export function getLands(): Land[] {
  return cache.lands;
}

/** Enregistre un terrain : visible immédiatement, persisté vers l'API. */
export async function saveLand(land: Land): Promise<Land> {
  const temp = { ...land };
  upsertSync('lands', temp);
  try {
    const server = (await saveLandApi(temp as never)) as unknown as Land;
    if (temp.id !== server.id) replaceSync('lands', temp.id, server);
    else replaceSync('lands', server.id, server);
    return server;
  } catch {
    warnSyncFailed(`Terrain ${temp.title}`);
    return temp;
  }
}

export async function deleteLand(id: string): Promise<void> {
  removeSync('lands', id);
  if (/^\d+$/.test(id)) await deleteApi('lands', id).catch(() => {});
}

/** Charge volontairement les exemples ; le backend conserve les données existantes. */
export async function resetLands(): Promise<void> {
  const res = (await resetLandsApi()) as { lands?: Land[] };
  if (res?.lands) {
    cache.lands = res.lands; // cache mis à jour immédiatement
  }
}

// --- Messages de contact ---

export function getMessages(): ContactMessage[] {
  return cache.messages;
}

export async function updateMessage(
  id: string,
  patch: Partial<ContactMessage>,
): Promise<void> {
  const current = cache.messages.find((m) => m.id === id);
  if (!current) return;
  await updateMessageApi(id, { status: patch.status });
  upsertSync('messages', { ...current, ...patch });
}

export async function deleteMessage(id: string): Promise<void> {
  if (/^\d+$/.test(id)) await deleteApi('messages', id);
  removeSync('messages', id);
}

// --- Authentification admin (jeton Sanctum via l'API Laravel) ---

/**
 * Connexion admin. Retourne null en cas de succès, sinon le message à
 * afficher (identifiants invalides, serveur injoignable, trop d'essais…).
 */
export async function login(
  email: string,
  password: string,
): Promise<string | null> {
  try {
    await apiLogin(email, password);
    return null;
  } catch (error) {
    if (error instanceof ApiError && error.status > 0) {
      // Le serveur a répondu : son message est parlant (401, 422, 429…).
      return error.status === 401 ? 'Identifiants incorrects.' : error.message;
    }
    return 'Impossible de joindre le serveur. Vérifiez qu’il est démarré, puis réessayez.';
  }
}

export async function logout(): Promise<void> {
  await apiLogout();
}

export function isAuthenticated(): boolean {
  return isLoggedIn();
}
