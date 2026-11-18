import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';

const MEDIA_IDB_NAME = 'CaptainsLoggerMediaDB';
const MEDIA_IDB_STORE = 'media_files';
const LEGACY_PDF_IDB_NAME = 'CaptainsLoggerManualsDB';
const LEGACY_PDF_IDB_STORE = 'pdf_files';

export interface StoredMediaRecord {
  mediaKey: string;
  mimeType: string;
  sizeBytes: number;
  buffer: ArrayBuffer;
  fileName?: string;
  savedAt: string;
}

const displayUrlCache = new Map<string, string>();
let mediaIdbPromise: Promise<IDBDatabase> | null = null;

function openMediaIdb(): Promise<IDBDatabase> {
  if (!mediaIdbPromise) {
    mediaIdbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      if (typeof window === 'undefined' || !('indexedDB' in window)) {
        reject(new Error('IndexedDB is not supported in this environment'));
        return;
      }
      const req = window.indexedDB.open(MEDIA_IDB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(MEDIA_IDB_STORE)) {
          db.createObjectStore(MEDIA_IDB_STORE);
        }
      };
      req.onsuccess = () => {
        const db = req.result;
        db.onclose = () => {
          mediaIdbPromise = null;
        };
        resolve(db);
      };
      req.onerror = () => {
        mediaIdbPromise = null;
        reject(req.error || new Error('Failed to open Media IndexedDB'));
      };
    });
  }
  return mediaIdbPromise;
}

export const MEDIA_RESTORED_EVENT = 'captains-media-restored';

export function sanitizeMediaFilename(mediaKey: string): string {
  return mediaKey.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function base64ToUint8Array(base64: string): Uint8Array {
  const clean = base64.includes(',') ? base64.split(',')[1] : base64;
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const header = dataUrl.slice(0, dataUrl.indexOf(','));
  const mimeMatch = header.match(/data:([^;]+)/i);
  const mimeType = mimeMatch?.[1] || 'application/octet-stream';
  const bytes = base64ToUint8Array(dataUrl);
  return new Blob([bytes.buffer as ArrayBuffer], { type: mimeType });
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error || new Error('Failed to convert Blob to DataURL'));
    reader.readAsDataURL(blob);
  });
}

export function buildPhotoMediaKey(photoId: string, mimeType = 'image/jpeg'): string {
  const ext = mimeType.includes('png') ? 'png' : mimeType.includes('webp') ? 'webp' : 'jpg';
  return `photo_${sanitizeMediaFilename(photoId)}.${ext}`;
}

export function buildPdfMediaKey(kind: 'invoice' | 'manual', id: string): string {
  return `${kind}_${sanitizeMediaFilename(id)}.pdf`;
}

/**
 * Persists a binary Blob (photo or PDF) into persistent local storage:
 * 1. Native Capacitor Filesystem (Directory.Data/media/<key>) on Android/iOS
 * 2. IndexedDB blob store (CaptainsLoggerMediaDB) on all platforms
 */
export async function saveMediaBlob(
  mediaKey: string,
  blob: Blob,
  meta?: { fileName?: string; mimeType?: string }
): Promise<{ mimeType: string; sizeBytes: number }> {
  const safeKey = sanitizeMediaFilename(mediaKey);
  const mimeType = meta?.mimeType || blob.type || 'application/octet-stream';
  const buffer = await blob.arrayBuffer();

  // Invalidate any stale cached URL for this key
  const existingUrl = displayUrlCache.get(safeKey);
  if (existingUrl && existingUrl.startsWith('blob:')) {
    URL.revokeObjectURL(existingUrl);
  }
  displayUrlCache.delete(safeKey);

  // 1. IndexedDB persistence (fast offline store with gigabytes of quota)
  try {
    const idb = await openMediaIdb();
    await new Promise<void>((resolve, reject) => {
      const tx = idb.transaction(MEDIA_IDB_STORE, 'readwrite');
      const record: StoredMediaRecord = {
        mediaKey: safeKey,
        mimeType,
        sizeBytes: buffer.byteLength,
        buffer,
        fileName: meta?.fileName,
        savedAt: new Date().toISOString(),
      };
      tx.objectStore(MEDIA_IDB_STORE).put(record, safeKey);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('Failed to save binary to Media IndexedDB:', err);
  }

  // 2. Native Android / iOS persistent Filesystem (Directory.Data survives updates & avoids WebView limits)
  if (Capacitor.isNativePlatform()) {
    try {
      const base64Data = arrayBufferToBase64(buffer);
      await Filesystem.writeFile({
        path: `media/${safeKey}`,
        data: base64Data,
        directory: Directory.Data,
        recursive: true,
      });
    } catch (err) {
      console.warn('Failed to write binary to native Directory.Data/media:', err);
    }
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(MEDIA_RESTORED_EVENT, { detail: { mediaKey: safeKey } })
    );
  }

  return { mimeType, sizeBytes: buffer.byteLength };
}

export async function saveMediaDataUrl(
  mediaKey: string,
  dataUrl: string,
  fileName?: string
): Promise<{ mimeType: string; sizeBytes: number }> {
  const blob = dataUrlToBlob(dataUrl);
  return saveMediaBlob(mediaKey, blob, { fileName, mimeType: blob.type });
}

async function readLegacyPdfStore(legacyKey: string): Promise<Blob | null> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) return null;
  try {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = window.indexedDB.open(LEGACY_PDF_IDB_NAME, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(LEGACY_PDF_IDB_STORE)) {
          req.result.createObjectStore(LEGACY_PDF_IDB_STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    const record = await new Promise<{ buffer?: ArrayBuffer; mimeType?: string } | undefined>(
      (resolve, reject) => {
        const tx = db.transaction(LEGACY_PDF_IDB_STORE, 'readonly');
        const req = tx.objectStore(LEGACY_PDF_IDB_STORE).get(legacyKey);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }
    );
    if (record?.buffer) {
      return new Blob([record.buffer], { type: record.mimeType || 'application/pdf' });
    }
  } catch {
    // Ignore if legacy DB does not exist
  }
  return null;
}

/**
 * Reads a stored binary file as a Blob from local device storage:
 * 1. Native Directory.Data/media/<key> (on Capacitor)
 * 2. Media IndexedDB (CaptainsLoggerMediaDB)
 * 3. Legacy PDF IndexedDB fallback if applicable
 */
export async function getMediaBlob(mediaKey: string): Promise<Blob | null> {
  const safeKey = sanitizeMediaFilename(mediaKey);

  // 1. Native Capacitor Directory.Data
  if (Capacitor.isNativePlatform()) {
    try {
      const read = await Filesystem.readFile({
        path: `media/${safeKey}`,
        directory: Directory.Data,
      });
      if (typeof read.data === 'string') {
        const bytes = base64ToUint8Array(read.data);
        const guessedMime = safeKey.endsWith('.pdf')
          ? 'application/pdf'
          : safeKey.endsWith('.png')
            ? 'image/png'
            : safeKey.endsWith('.webp')
              ? 'image/webp'
              : 'image/jpeg';
        return new Blob([bytes.buffer as ArrayBuffer], { type: guessedMime });
      }
      if (read.data instanceof Blob) {
        return read.data;
      }
    } catch {
      // Fall through to IndexedDB
    }
  }

  // 2. IndexedDB Media Store
  try {
    const idb = await openMediaIdb();
    const record = await new Promise<StoredMediaRecord | undefined>((resolve, reject) => {
      const tx = idb.transaction(MEDIA_IDB_STORE, 'readonly');
      const req = tx.objectStore(MEDIA_IDB_STORE).get(safeKey);
      req.onsuccess = () => resolve(req.result as StoredMediaRecord | undefined);
      req.onerror = () => reject(req.error);
    });
    if (record?.buffer) {
      return new Blob([record.buffer], { type: record.mimeType || 'application/octet-stream' });
    }
  } catch (err) {
    console.warn('Failed to read binary from Media IndexedDB:', err);
  }

  // 3. Optional fallback to legacy Manuals/Invoices store if key maps to one
  if (safeKey.startsWith('invoice_') && safeKey.endsWith('.pdf')) {
    return readLegacyPdfStore(safeKey.replace(/\.pdf$/, ''));
  }
  if (safeKey.startsWith('manual_') && safeKey.endsWith('.pdf')) {
    return readLegacyPdfStore(safeKey.replace(/\.pdf$/, ''));
  }

  return null;
}

/**
 * Resolves a fast, browser/WebView-renderable URL for an image or binary.
 * Prefers Capacitor's native file URI on Android/iOS (zero base64 RAM overhead),
 * otherwise returns a cached blob: URL from IndexedDB, or fallbackUrl.
 */
export async function getMediaDisplayUrl(
  mediaKey?: string,
  fallbackUrl?: string
): Promise<string | null> {
  if (!mediaKey) {
    return fallbackUrl || null;
  }

  const safeKey = sanitizeMediaFilename(mediaKey);
  const cached = displayUrlCache.get(safeKey);
  if (cached) {
    return cached;
  }

  if (Capacitor.isNativePlatform()) {
    try {
      const stat = await Filesystem.getUri({
        path: `media/${safeKey}`,
        directory: Directory.Data,
      });
      if (stat.uri) {
        // Verify file actually exists before returning native URI
        await Filesystem.stat({
          path: `media/${safeKey}`,
          directory: Directory.Data,
        });
        const converted = Capacitor.convertFileSrc(stat.uri);
        displayUrlCache.set(safeKey, converted);
        return converted;
      }
    } catch {
      // File may only be in IndexedDB; fall through
    }
  }

  const blob = await getMediaBlob(safeKey);
  if (blob) {
    const objectUrl = URL.createObjectURL(blob);
    displayUrlCache.set(safeKey, objectUrl);
    return objectUrl;
  }

  return fallbackUrl || null;
}

export async function hasMediaLocally(mediaKey: string): Promise<boolean> {
  const safeKey = sanitizeMediaFilename(mediaKey);

  if (Capacitor.isNativePlatform()) {
    try {
      await Filesystem.stat({
        path: `media/${safeKey}`,
        directory: Directory.Data,
      });
      return true;
    } catch {
      // Check IndexedDB next
    }
  }

  try {
    const idb = await openMediaIdb();
    const count = await new Promise<number>((resolve, reject) => {
      const tx = idb.transaction(MEDIA_IDB_STORE, 'readonly');
      const req = tx.objectStore(MEDIA_IDB_STORE).count(safeKey);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return count > 0;
  } catch {
    return false;
  }
}

export async function deleteMediaFile(mediaKey: string): Promise<void> {
  const safeKey = sanitizeMediaFilename(mediaKey);

  const cached = displayUrlCache.get(safeKey);
  if (cached && cached.startsWith('blob:')) {
    URL.revokeObjectURL(cached);
  }
  displayUrlCache.delete(safeKey);

  try {
    const idb = await openMediaIdb();
    await new Promise<void>((resolve, reject) => {
      const tx = idb.transaction(MEDIA_IDB_STORE, 'readwrite');
      tx.objectStore(MEDIA_IDB_STORE).delete(safeKey);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Ignore delete errors
  }

  if (Capacitor.isNativePlatform()) {
    try {
      await Filesystem.deleteFile({
        path: `media/${safeKey}`,
        directory: Directory.Data,
      });
    } catch {
      // Ignore if file didn't exist natively
    }
  }
}

export async function listLocalMediaKeys(): Promise<string[]> {
  const keys = new Set<string>();

  try {
    const idb = await openMediaIdb();
    const idbKeys = await new Promise<IDBValidKey[]>((resolve, reject) => {
      const tx = idb.transaction(MEDIA_IDB_STORE, 'readonly');
      const req = tx.objectStore(MEDIA_IDB_STORE).getAllKeys();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    for (const k of idbKeys) {
      if (typeof k === 'string') keys.add(k);
    }
  } catch {
    // Ignore IDB errors
  }

  if (Capacitor.isNativePlatform()) {
    try {
      const dir = await Filesystem.readdir({
        path: 'media',
        directory: Directory.Data,
      });
      for (const entry of dir.files) {
        keys.add(entry.name);
      }
    } catch {
      // media/ folder may not exist yet
    }
  }

  return Array.from(keys);
}
