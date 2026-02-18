// src/services/mediaCacheService.ts
/**
 * IndexedDB-backed image cache.
 *
 * Stores **thumbnail** blobs + a metadata manifest so returning visitors
 * get an instant gallery without re-downloading every image.
 * Full-resolution images are never cached — they are streamed on demand
 * by the modal viewer.
 *
 * Cache-hit path (< 50 ms on most devices):
 *   1. Read the manifest → restore `ImageMeta[]` immediately
 *   2. Read thumbnail blobs from object store → create blob URLs
 *
 * Sync path (runs after cache is served):
 *   1. `fetchAllImageMetadata()` to get the latest file list
 *   2. Diff against manifest:
 *        • new ids   → download thumbnail & cache
 *        • removed   → evict from cache
 *        • unchanged → keep cached blob
 *   3. Update the manifest
 */

import type { ImageMeta, PreloadedImage } from "./storageService";
import type { VideoMeta } from "../types/mediaTypes";

const DB_NAME = "gallery-cache";
const DB_VERSION = 1;
const BLOB_STORE = "image-blobs";
const META_STORE = "meta";
const MANIFEST_KEY = "manifest";

const videoKey = (id: string) => `video:${id}`;

/* ─── helpers ──────────────────────────────────────────── */

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(BLOB_STORE)) {
        db.createObjectStore(BLOB_STORE); // keyed by ImageMeta.id
      }
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE); // single key: "manifest"
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function idbGet<T>(
  db: IDBDatabase,
  store: string,
  key: string,
): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readonly");
    const req = tx.objectStore(store).get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
}

function idbPut(
  db: IDBDatabase,
  store: string,
  key: string,
  value: unknown,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function idbDelete(db: IDBDatabase, store: string, key: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function idbGetAllKeys(db: IDBDatabase, store: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readonly");
    const req = tx.objectStore(store).getAllKeys();
    req.onsuccess = () => resolve(req.result as string[]);
    req.onerror = () => reject(req.error);
  });
}

/* ─── public API ───────────────────────────────────────── */

export type CachedGallery = {
  metas: ImageMeta[];
  preloaded: PreloadedImage[];
};

/**
 * Read the entire gallery from the local cache.
 * Returns `null` if no cache exists yet.
 */
export async function loadFromCache(): Promise<CachedGallery | null> {
  try {
    const db = await openDB();
    const manifest = await idbGet<ImageMeta[]>(db, META_STORE, MANIFEST_KEY);

    if (!manifest || !manifest.length) {
      db.close();
      return null;
    }

    // Read all cached blobs in parallel
    const preloaded: PreloadedImage[] = [];

    await Promise.all(
      manifest.map(async (meta) => {
        const blob = await idbGet<Blob>(db, BLOB_STORE, meta.id);
        if (blob) {
          const objectUrl = URL.createObjectURL(blob);
          preloaded.push({ meta, blob, objectUrl });
        }
      }),
    );

    db.close();

    // Sort the same way storageService does (newest first)
    preloaded.sort((a, b) => Date.parse(b.meta.date) - Date.parse(a.meta.date));

    return { metas: manifest, preloaded };
  } catch (err) {
    console.warn("[ImageCache] Failed to load from cache:", err);
    return null;
  }
}

/**
 * Diff the fresh metadata list against the cache, download only new images,
 * evict removed ones, and persist the updated manifest.
 *
 * @returns the full `PreloadedImage[]` (cached + newly fetched) in order.
 */
export async function syncCache(
  freshMetas: ImageMeta[],
  onProgress?: (loaded: number, total: number) => void,
): Promise<PreloadedImage[]> {
  const db = await openDB();

  // 1. Read current cached keys
  const cachedKeys = new Set(await idbGetAllKeys(db, BLOB_STORE));

  const freshIds = new Set(freshMetas.map((m) => m.id));

  // 2. Determine what to add and what to remove
  const toDownload = freshMetas.filter((m) => !cachedKeys.has(m.id));
  const toRemove = [...cachedKeys].filter((key) => !freshIds.has(key));

  // 3. Evict deleted images
  await Promise.all(toRemove.map((key) => idbDelete(db, BLOB_STORE, key)));

  // 4. Download new images and cache them
  const total = freshMetas.length;
  let loaded = total - toDownload.length; // cached ones count as loaded

  // Report initial progress for already-cached images
  onProgress?.(loaded, total);

  const newPreloaded: PreloadedImage[] = [];

  // Download in batches to avoid overwhelming the browser
  const BATCH_SIZE = 60;
  for (let i = 0; i < toDownload.length; i += BATCH_SIZE) {
    const batch = toDownload.slice(i, i + BATCH_SIZE);

    const results = await Promise.all(
      batch.map(async (meta) => {
        try {
          // Download the thumbnail, not the full-res image
          const response = await fetch(meta.thumbUrl, { mode: "cors" });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const blob = await response.blob();

          // Persist to IndexedDB
          await idbPut(db, BLOB_STORE, meta.id, blob);

          const objectUrl = URL.createObjectURL(blob);
          loaded++;
          onProgress?.(loaded, total);

          return { meta, blob, objectUrl } as PreloadedImage;
        } catch (err) {
          console.warn(`[ImageCache] Failed to cache ${meta.id}:`, err);
          loaded++;
          onProgress?.(loaded, total);
          return null;
        }
      }),
    );

    newPreloaded.push(...(results.filter(Boolean) as PreloadedImage[]));
  }

  // 5. Build the full preloaded list from cache + new downloads
  const allPreloaded: PreloadedImage[] = [];

  for (const meta of freshMetas) {
    // Check if we just downloaded it
    const justDownloaded = newPreloaded.find((p) => p.meta.id === meta.id);
    if (justDownloaded) {
      allPreloaded.push(justDownloaded);
      continue;
    }

    // Otherwise read from cache
    const blob = await idbGet<Blob>(db, BLOB_STORE, meta.id);
    if (blob) {
      const objectUrl = URL.createObjectURL(blob);
      allPreloaded.push({ meta, blob, objectUrl });
    }
  }

  // 6. Persist updated manifest (uses freshMetas so metadata updates are captured)
  await idbPut(db, META_STORE, MANIFEST_KEY, freshMetas);

  db.close();

  return allPreloaded;
}

/**
 * Completely clear the cache (used on logout).
 */
export async function clearCache(): Promise<void> {
  try {
    const db = await openDB();
    const blobTx = db.transaction(BLOB_STORE, "readwrite");
    blobTx.objectStore(BLOB_STORE).clear();
    await new Promise<void>((resolve, reject) => {
      blobTx.oncomplete = () => resolve();
      blobTx.onerror = () => reject(blobTx.error);
    });

    const metaTx = db.transaction(META_STORE, "readwrite");
    metaTx.objectStore(META_STORE).clear();
    await new Promise<void>((resolve, reject) => {
      metaTx.oncomplete = () => resolve();
      metaTx.onerror = () => reject(metaTx.error);
    });

    db.close();
  } catch (err) {
    console.warn("[ImageCache] Failed to clear cache:", err);
  }
}

/**
 * Cache ONLY video thumbnail JPEGs.
 *
 * Rules:
 * - Keys are namespaced: video:<id>
 * - Never fetch or store any .mp4/.mov bytes
 */
export async function syncVideoThumbCache(
  videoMetas: VideoMeta[],
): Promise<void> {
  if (!videoMetas.length) return;

  const db = await openDB();
  const cachedKeys = new Set(await idbGetAllKeys(db, BLOB_STORE));

  const wanted = new Set(videoMetas.map((m) => videoKey(m.id)));
  const existingVideoKeys = [...cachedKeys].filter((k) =>
    k.startsWith("video:"),
  );

  // Evict removed video thumbnails
  const toRemove = existingVideoKeys.filter((k) => !wanted.has(k));
  await Promise.all(toRemove.map((key) => idbDelete(db, BLOB_STORE, key)));

  // Download missing thumbs
  const toDownload = videoMetas.filter((m) => !cachedKeys.has(videoKey(m.id)));
  const BATCH_SIZE = 60;
  for (let i = 0; i < toDownload.length; i += BATCH_SIZE) {
    const batch = toDownload.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(async (meta) => {
        try {
          const response = await fetch(meta.thumbUrl, { mode: "cors" });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const blob = await response.blob();

          await idbPut(db, BLOB_STORE, videoKey(meta.id), blob);
        } catch (err) {
          console.warn(
            `[ImageCache] Failed to cache video thumb ${meta.id}:`,
            err,
          );
        }
      }),
    );
  }

  db.close();
}

/**
 * Load cached video thumbnail object URLs for the provided videos.
 *
 * Returned keys are raw video IDs (without the `video:` prefix).
 */
export async function loadVideoThumbUrlsFromCache(
  videoMetas: VideoMeta[],
): Promise<Map<string, string>> {
  if (!videoMetas.length) return new Map();
  if (typeof URL === "undefined" || typeof URL.createObjectURL !== "function") {
    return new Map();
  }

  let db: IDBDatabase | null = null;
  try {
    db = await openDB();
    const database = db;
    const pairs = await Promise.all(
      videoMetas.map(async (meta) => {
        const blob = await idbGet<Blob>(database, BLOB_STORE, videoKey(meta.id));
        if (!blob) return null;
        return [meta.id, URL.createObjectURL(blob)] as [string, string];
      }),
    );

    return new Map(
      pairs.filter((pair): pair is [string, string] => pair !== null),
    );
  } catch (err) {
    console.warn("[ImageCache] Failed to load cached video thumbs:", err);
    return new Map();
  } finally {
    db?.close();
  }
}
