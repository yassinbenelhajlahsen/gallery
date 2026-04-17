// src/hooks/useFullResLoader.ts
import { useCallback, useRef, useState } from "react";
import type { ImageMeta } from "../services/storageService";

/**
 * Fetches full-resolution images as blob URLs for a given set of image IDs.
 *
 * Usage:
 *   const { resolveUrl, requestFullRes } = useFullResLoader();
 *   requestFullRes(imageMetas);            // start loading
 *   const url = resolveUrl(meta, thumbUrl); // returns full-res blob or thumb fallback
 *
 * Pass `cachedResolver` (typically `useGallery().resolveFullResUrl`) to
 * prefer a locally cached blob URL over the Firebase download URL.
 */
export function useFullResLoader(
  cachedResolver?: (meta: ImageMeta) => string | null,
) {
  const [fullResUrls, setFullResUrls] = useState<Map<string, string>>(
    new Map(),
  );
  const loadingIdsRef = useRef<Set<string>>(new Set());

  /**
   * Request full-res images for the given metas.
   * Already-loaded or in-flight images are skipped.
   */
  const requestFullRes = useCallback((metas: ImageMeta[]) => {
    // Instead of fetching bytes and creating blob URLs, record the
    // authoritative download URL for each image so the browser can load
    // the image directly via <img src="...">. This avoids manual blob
    // handling and lets the browser stream/cache/prioritize naturally.
    metas.forEach((meta) => {
      if (loadingIdsRef.current.has(meta.id)) return;

      loadingIdsRef.current.add(meta.id);

      try {
        setFullResUrls((prev) => {
          if (prev.has(meta.id)) {
            // already resolved
            return prev;
          }
          const next = new Map(prev);
          next.set(meta.id, meta.downloadUrl);
          return next;
        });
      } finally {
        loadingIdsRef.current.delete(meta.id);
      }
    });
  }, []);

  /**
   * Evict full-res blob URLs for images NOT in the given set of IDs.
   */
  const evict = useCallback((keepIds: Set<string>) => {
    // Clean loading refs and evict any stored download URLs for images
    for (const id of loadingIdsRef.current) {
      if (!keepIds.has(id)) {
        loadingIdsRef.current.delete(id);
      }
    }

    setFullResUrls((prev) => {
      let changed = false;
      const next = new Map(prev);
      for (const [id] of prev) {
        if (!keepIds.has(id)) {
          next.delete(id);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, []);

  /**
   * Resolve the best available URL for an image:
   * cached blob → recorded download URL → provided fallback
   */
  const resolveUrl = useCallback(
    (meta: ImageMeta, fallbackUrl: string): string => {
      const cached = cachedResolver?.(meta);
      if (cached) return cached;
      return fullResUrls.get(meta.id) ?? fallbackUrl;
    },
    [fullResUrls, cachedResolver],
  );

  /**
   * Check if an image has its full-res version loaded (cached blob OR recorded URL).
   */
  const hasFullRes = useCallback(
    (id: string): boolean => fullResUrls.has(id),
    [fullResUrls],
  );

  return { resolveUrl, requestFullRes, evict, hasFullRes, fullResUrls };
}
