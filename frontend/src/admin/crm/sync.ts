/* ==========================================================================
   Cache back office — le pont entre l'API Laravel et les écrans admin.
   Les écrans lisent les collections de façon SYNCHRONE (comme avant, avec
   le localStorage) ; ce cache est hydraté une fois par session depuis
   GET /api/v1/admin/bootstrap, et chaque sauvegarde repart vers l'API.

   Conséquence : plus AUCUNE donnée métier ne vit dans le navigateur —
   PostgreSQL est la source de vérité, partagée avec le site public.
   ========================================================================== */

import { bootstrap } from '../../services/adminService';
import type { ContactMessage, Land } from '../../types';
import { notice } from './dialog';
import type { BuyRequest, LandFile } from './model';
import type { Client, Realisation, SpecificSearch } from './people';

export const cache = {
  lands: [] as Land[],
  requests: [] as BuyRequest[],
  landFiles: [] as LandFile[],
  clients: [] as Client[],
  searches: [] as SpecificSearch[],
  realisations: [] as Realisation[],
  messages: [] as ContactMessage[],
};

let presentationAllowed = false;
export const canLoadPresentation = () => presentationAllowed;

let refreshError = '';
const syncListeners = new Set<() => void>();
export const getRefreshError = () => refreshError;
export function subscribeSyncState(fn: () => void) {
  syncListeners.add(fn);
  return () => {
    syncListeners.delete(fn);
  };
}
function setRefreshError(message: string) {
  refreshError = message;
  syncListeners.forEach((fn) => fn());
}

let hydrated = false;
export const isHydrated = () => hydrated;

/* --- Abonnés : les écrans s'enregistrent ici pour se re-rendre dès que le
       cache change (sauvegarde locale, resynchronisation périodique…).
       C'est ce qui permet la mise à jour SANS rafraîchissement de page. --- */
const listeners = new Set<() => void>();
export function subscribeCache(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
const notifyCache = () => listeners.forEach((fn) => fn());

/** Remplit le cache depuis la réponse de /admin/bootstrap. */
export function hydrate(data: {
  presentationAllowed?: boolean;
  lands?: Land[];
  requests?: BuyRequest[];
  clients?: Client[];
  searches?: SpecificSearch[];
  landFiles?: LandFile[];
  realisations?: Realisation[];
  messages?: ContactMessage[];
}) {
  presentationAllowed = data.presentationAllowed === true;
  cache.lands = data.lands ?? [];
  cache.requests = data.requests ?? [];
  cache.clients = data.clients ?? [];
  cache.searches = data.searches ?? [];
  cache.landFiles = data.landFiles ?? [];
  cache.realisations = data.realisations ?? [];
  cache.messages = data.messages ?? [];
  hydrated = true;
  lastHydrateAt = Date.now();
  notifyCache();
}

/* --- Resynchronisation : les fiches créées ailleurs (site public, autre
       onglet) doivent apparaître sans F5. Chaque écran de liste appelle
       refreshCache() à l'ouverture ; throttle 10 s pour ne pas spammer. --- */
let lastHydrateAt = 0;
let refreshing: Promise<void> | null = null;

export function refreshCache(force = false): Promise<void> {
  if (!hydrated) return Promise.resolve(); // le premier chargement est fait par AdminLayout
  if (!force && Date.now() - lastHydrateAt < 10_000) return Promise.resolve();
  refreshing ??= bootstrap()
    .then((data) => {
      // Les saisies optimistes pas encore confirmées par l'API sont préservées.
      const pending = Object.fromEntries(
        (Object.keys(cache) as (keyof typeof cache)[]).map((k) => [
          k,
          (cache[k] as { id: string }[]).filter((x) => x.id.startsWith('tmp-')),
        ]),
      );
      hydrate(data as never);
      setRefreshError('');
      for (const k of Object.keys(pending) as (keyof typeof cache)[]) {
        (cache[k] as { id: string }[]).unshift(
          ...(pending[k] as { id: string }[]),
        );
      }
    })
    .catch((error) => {
      setRefreshError(
        error instanceof Error
          ? error.message
          : 'Impossible d’actualiser les données.',
      ); /* Dernier cache confirmé conservé. */
    })
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

export function resetCache() {
  setRefreshError('');
  hydrate({});
  hydrated = false;
}

/* --- Helpers d'upsert optimiste : la donnée est visible immédiatement,
       puis remplacée par la version serveur quand la réponse arrive. --- */

// IMPORTANT : chaque fonction ci-dessous RÉASSIGNE cache[key] à un NOUVEAU
// tableau (au lieu de muter `list` en place avec `list[i] = …` / `splice` /
// `unshift`). Les écrans s'abonnent via subscribeCache() puis appellent
// setState(getLands()) : si cache.lands gardait la même référence après une
// mutation, React considère que l'état n'a pas changé (Object.is) et NE
// RE-RENDER PAS — c'était la cause des écrans « figés » après une action
// (ex. vente enregistrée mais invisible tant que la page n'était pas
// rechargée manuellement).
export function upsertSync<K extends keyof typeof cache>(
  key: K,
  item: (typeof cache)[K][number],
  serverItem?: (typeof cache)[K][number],
): void {
  const list = cache[key] as { id: string }[];
  const target = serverItem ?? item;
  const i = list.findIndex(
    (x) => x.id === item.id || (serverItem && x.id === serverItem.id),
  );
  cache[key] = (
    i >= 0 ? list.map((x, idx) => (idx === i ? target : x)) : [target, ...list]
  ) as never;
  notifyCache();
}

export function replaceSync<K extends keyof typeof cache>(
  key: K,
  tempId: string,
  serverItem: (typeof cache)[K][number],
): void {
  const list = cache[key] as { id: string }[];
  cache[key] = list.map((x) => (x.id === tempId ? serverItem : x)) as never;
  notifyCache();
}

export function removeSync<K extends keyof typeof cache>(
  key: K,
  id: string,
): void {
  const list = cache[key] as { id: string }[];
  cache[key] = list.filter((x) => x.id !== id) as never;
  notifyCache();
}

/* --- Alerte de synchronisation : ne JAMAIS échouer en silence. ---
   La donnée optimiste reste affichée, mais l'utilisateur est prévenu
   qu'elle sera perdue au rechargement si l'API n'a pas enregistré. */
let lastWarn = 0;
export function warnSyncFailed(what: string): void {
  console.error(`Échec de l'enregistrement API : ${what}`);
  const t = Date.now();
  if (t - lastWarn > 4000) {
    // une seule alerte par rafale
    lastWarn = t;
    void notice(
      `⚠️ « ${what} » n'a pas pu être enregistré sur le serveur.\n\n` +
        `La donnée est affichée localement mais sera PERDUE au rechargement de la page.\n` +
        `Vérifiez que l'API backend est démarrée et accessible, puis réessayez.`,
    );
  }
}
