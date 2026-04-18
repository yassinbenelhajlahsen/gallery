import { useState, useEffect, useRef } from "react";
import type { MediaMeta } from "../types/mediaTypes";
import type { ImageMeta } from "../services/storageService";
import { isImageMeta } from "../types/mediaTypes";

interface FullResPreloaderOptions {
  isOpen: boolean;
  media: MediaMeta[];
  dataIndex: number;
  preloadAll: boolean;
  preloadAhead: number;
  preloadBehind: number;
  resolveFullResUrl?: (image: ImageMeta) => string | null;
}

export function useFullResPreloader({
  isOpen,
  media,
  dataIndex,
  preloadAll,
  preloadAhead,
  preloadBehind,
  resolveFullResUrl,
}: FullResPreloaderOptions) {
  const [fullResUrls, setFullResUrls] = useState<Map<string, string>>(new Map());
  const loadingIdsRef = useRef<Set<string>>(new Set());

  // Reset on close
  useEffect(() => {
    if (!isOpen) {
      const timer = setTimeout(() => {
        setFullResUrls(new Map());
        loadingIdsRef.current.clear();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Windowed preloading — load ±window around current index, evict outside
  useEffect(() => {
    if (!isOpen || !media.length) return;

    const wantedMediaIndices = new Set<number>();
    if (preloadAll) {
      for (let i = 0; i < media.length; i++) wantedMediaIndices.add(i);
    } else {
      for (let offset = -preloadBehind; offset <= preloadAhead; offset++) {
        const idx = dataIndex + offset;
        if (idx >= 0 && idx < media.length) wantedMediaIndices.add(idx);
      }
    }

    const wantedImageIds = new Set<string>();
    wantedMediaIndices.forEach((idx) => {
      const item = media[idx];
      if (isImageMeta(item)) wantedImageIds.add(item.id);
    });

    // Intentional: evicts out-of-window URLs to free memory; single batched update.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFullResUrls((prev) => {
      let changed = false;
      const next = new Map(prev);
      for (const [id] of prev) {
        if (!wantedImageIds.has(id)) {
          next.delete(id);
          changed = true;
        }
      }
      return changed ? next : prev;
    });

    for (const id of loadingIdsRef.current) {
      if (!wantedImageIds.has(id)) loadingIdsRef.current.delete(id);
    }

    const additions = new Map<string, string>();
    wantedMediaIndices.forEach((idx) => {
      const item = media[idx];
      if (!isImageMeta(item)) return;
      const img = item;
      if (loadingIdsRef.current.has(img.id)) return;
      loadingIdsRef.current.add(img.id);
      const cachedUrl = resolveFullResUrl?.(img) ?? null;
      additions.set(img.id, cachedUrl ?? img.downloadUrl);
      loadingIdsRef.current.delete(img.id);
    });

    if (additions.size > 0) {
      setFullResUrls((prev) => {
        let changed = false;
        const next = new Map(prev);
        additions.forEach((url, id) => {
          if (!next.has(id)) {
            next.set(id, url);
            changed = true;
          }
        });
        return changed ? next : prev;
      });
    }
  }, [dataIndex, isOpen, media, preloadAll, preloadAhead, preloadBehind, resolveFullResUrl]);

  return { fullResUrls };
}
