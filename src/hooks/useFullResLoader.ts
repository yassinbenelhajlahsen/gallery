// src/hooks/useFullResLoader.ts
import { useCallback, useEffect, useRef, useState } from "react";
import type { ImageMeta } from "../services/storageService";

/**
 * Fetches full-resolution images as blob URLs for a given set of image IDs.
 *
 * Usage:
 *   const { resolveUrl, requestFullRes } = useFullResLoader();
 *   requestFullRes(imageMetas);            // start loading
 *   const url = resolveUrl(meta, thumbUrl); // returns full-res blob or thumb fallback
 */
export function useFullResLoader() {
  const [fullResUrls, setFullResUrls] = useState<Map<string, string>>(
    new Map(),
  );
  const loadingIdsRef = useRef<Set<string>>(new Set());
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    const loadingIds = loadingIdsRef.current;
    return () => {
      mountedRef.current = false;
      // Revoke all blob URLs on unmount
      setFullResUrls((prev) => {
        prev.forEach((url) => {
          if (url.startsWith("blob:")) URL.revokeObjectURL(url);
        });
        return new Map();
      });
      loadingIds.clear();
    };
  }, []);

  /**
   * Request full-res images for the given metas.
   * Already-loaded or in-flight images are skipped.
   */
  const requestFullRes = useCallback((metas: ImageMeta[]) => {
    metas.forEach((meta) => {
      if (loadingIdsRef.current.has(meta.id)) return;

      loadingIdsRef.current.add(meta.id);

      fetch(meta.downloadUrl, { mode: "cors" })
        .then(async (res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const blob = await res.blob();
          const objectUrl = URL.createObjectURL(blob);
          if (!mountedRef.current) {
            URL.revokeObjectURL(objectUrl);
            return;
          }
          setFullResUrls((prev) => {
            if (prev.has(meta.id)) {
              URL.revokeObjectURL(objectUrl);
              return prev;
            }
            const next = new Map(prev);
            next.set(meta.id, objectUrl);
            return next;
          });
        })
        .catch((err) => {
          console.warn(`[FullRes] Failed to load ${meta.id}:`, err);
          loadingIdsRef.current.delete(meta.id);
        });
    });
  }, []);

  /**
   * Evict full-res blob URLs for images NOT in the given set of IDs.
   */
  const evict = useCallback((keepIds: Set<string>) => {
    // Clean loading refs
    for (const id of loadingIdsRef.current) {
      if (!keepIds.has(id)) {
        loadingIdsRef.current.delete(id);
      }
    }

    setFullResUrls((prev) => {
      let changed = false;
      const next = new Map(prev);
      for (const [id, url] of prev) {
        if (!keepIds.has(id)) {
          if (url.startsWith("blob:")) URL.revokeObjectURL(url);
          next.delete(id);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, []);

  /**
   * Resolve the best available URL for an image:
   * full-res blob → provided fallback
   */
  const resolveUrl = useCallback(
    (meta: ImageMeta, fallbackUrl: string): string => {
      return fullResUrls.get(meta.id) ?? fallbackUrl;
    },
    [fullResUrls],
  );

  /**
   * Check if an image has its full-res version loaded.
   */
  const hasFullRes = useCallback(
    (id: string): boolean => fullResUrls.has(id),
    [fullResUrls],
  );

  return { resolveUrl, requestFullRes, evict, hasFullRes, fullResUrls };
}
