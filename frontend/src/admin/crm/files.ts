// Stockage des fichiers (photos, vidéos, pièces) dans IndexedDB :
// localStorage est limité à ~5 Mo, insuffisant pour des photos de 15 Mo ou des vidéos de 100 Mo.
import { useEffect, useState } from 'react';
import { fetchProtectedFile, fetchProtectedFileRaw, uploadFile } from '../../services/adminService';
import type { StoredFile } from './model';

const DB = 'caimmo-files';
const STORE = 'files';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const req = fn(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function putFile(file: File, visibility: 'public' | 'private' = 'private'): Promise<StoredFile> {
  // Les pièces CRM sont privées par défaut ; seuls les médias explicitement
  // destinés au catalogue ou aux réalisations sont publiés.
  const uploaded = await uploadFile(file, visibility);
  return { id: uploaded.id, name: uploaded.name, type: uploaded.type, size: uploaded.size, url: uploaded.url };
}

export async function getBlob(f: StoredFile): Promise<Blob | undefined> {
  if (f.url) {
    // Pour les PDFs, on passe par l'endpoint base64 pour éviter IDM.
    if (/^application\/pdf(?:\s*;|$)/i.test(f.type ?? '') || /\.pdf$/i.test(f.name)) {
      const raw = await fetchProtectedFileRaw(f.url);
      return new Blob([raw.data], { type: raw.type });
    }
    return fetchProtectedFile(f.url);
  }
  return tx<Blob | undefined>('readonly', (s) => s.get(f.id));
}

/**
 * Charge les données brutes d'un fichier sous forme de Uint8Array.
 * Utilise l'endpoint base64 pour contourner IDM (Internet Download Manager)
 * qui intercepte toutes les réponses PDF directes.
 */
export async function getFileBytes(f: StoredFile): Promise<Uint8Array | undefined> {
  if (f.url) {
    try {
      const result = await fetchProtectedFileRaw(f.url);
      console.info(
        `[getFileBytes] « ${f.name} » chargé — ${result.data.length} bytes via base64`,
      );
      return result.data;
    } catch (error) {
      console.error(
        `[getFileBytes] Erreur pour « ${f.name} » :`,
        error,
      );
      return undefined;
    }
  }
  const blob = await tx<Blob | undefined>('readonly', (s) => s.get(f.id));
  if (!blob || blob.size === 0) return undefined;
  const buffer = await blob.arrayBuffer();
  return new Uint8Array(buffer);
}

export function removeFile(f: StoredFile) {
  if (!f.url) tx('readwrite', (s) => s.delete(f.id)).catch(() => {});
}

/**
 * URL affichable d'un fichier stocké (libérée automatiquement), accompagnée
 * d'un indicateur `resolved` : certains documents « historiques » (anciens
 * libellés texte migrés en objets, sans fichier réellement déposé) n'ont ni
 * URL serveur ni blob local — sans ce signal, l'aperçu restait bloqué sur
 * « Chargement… » indéfiniment au lieu d'annoncer l'absence de fichier.
 *
 * IMPORTANT : les PDFs ne passent PAS par ici. L'ancien endpoint /admin/files/
 * est intercepté par IDM (Internet Download Manager) qui vide le blob. Les PDFs
 * utilisent getFileBytes() qui passe par l'endpoint base64 /admin/files-raw/.
 */
export function useFileUrl(f?: StoredFile): string | undefined;
export function useFileUrl(f: StoredFile | undefined, withStatus: true): { url: string | undefined; resolved: boolean };
export function useFileUrl(f?: StoredFile, withStatus?: true) {
  // Détecte les PDFs pour ne PAS déclencher le fetch qui serait intercepté par IDM.
  const isPdf = f
    ? /^application\/pdf(?:\s*;|$)/i.test(f.type ?? '') || /\.pdf$/i.test(f.name)
    : false;
  const [url, setUrl] = useState<string | undefined>();
  const [resolved, setResolved] = useState(false);
  useEffect(() => {
    setResolved(false);
    if (!f || isPdf) { setUrl(undefined); setResolved(true); return; }
    let objectUrl: string | undefined;
    let alive = true;
    const source = f.url ? fetchProtectedFile(f.url) : tx<Blob | undefined>('readonly', (s) => s.get(f.id));
    source.then((blob) => {
      if (!alive) return;
      if (blob) { objectUrl = URL.createObjectURL(blob); setUrl(objectUrl); }
      setResolved(true);
    }).catch(() => { if (alive) { setUrl(undefined); setResolved(true); } });
    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [f?.id, f?.url, isPdf]);
  return withStatus ? { url, resolved } : url;
}

export async function downloadFile(f: StoredFile) {
  const blob = await getBlob(f);
  if (!blob) return;
  const safeName = f.name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[.-]+|[.-]+$/g, '') || 'document';
  const extension =
    f.type?.toLowerCase().startsWith('application/pdf') && !/\.pdf$/i.test(safeName)
      ? '.pdf'
      : '';
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = safeName + extension;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export function formatSize(bytes: number) {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / 1024 / 1024).toFixed(1)} Mo`;
}
