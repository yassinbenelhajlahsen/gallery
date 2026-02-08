// src/hooks/useGalleryLoadingProgress.ts
import { useEffect, useState } from "react";
import type { ImageMeta, PreloadedImage } from "../services/storageService";
import { fetchAllImageMetadata } from "../services/storageService";

const PRELOAD_LIMIT = 999;

const hasBrowserObjectUrl = () =>
  typeof URL !== "undefined" && !!URL.createObjectURL;

export function useGalleryLoadingProgress() {
  const [progress, setProgress] = useState(0);
  const [metas, setMetas] = useState<ImageMeta[]>([]);
  const [preloaded, setPreloaded] = useState<PreloadedImage[]>([]);
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        // Step 1: Fetch metadata (counts as first 20% of progress)
        const allMetas = await fetchAllImageMetadata();
        if (cancelled) return;

        setMetas(allMetas);
        setProgress(20);

        if (!allMetas.length) {
          setPreloaded([]);
          setIsComplete(true);
          setProgress(100);
          return;
        }

        // Step 2: Preload images (remaining 80% of progress)
        const total = Math.min(PRELOAD_LIMIT, allMetas.length);
        const targets = allMetas.slice(0, total);
        const supportsObjectUrl = hasBrowserObjectUrl();

        let loaded = 0;

        const preloadBatch = await Promise.all(
          targets.map(async (meta) => {
            // Download thumbnails only — full-res loaded on demand in modal
            const response = await fetch(meta.thumbUrl, { mode: "cors" });
            if (!response.ok) {
              throw new Error(
                `Failed to preload thumbnail: ${meta.storagePath}`,
              );
            }

            const blob = await response.blob();
            const objectUrl = supportsObjectUrl
              ? URL.createObjectURL(blob)
              : meta.thumbUrl;

            loaded++;
            if (!cancelled) {
              // Map loaded count to 20-100% range
              const loadProgress = 20 + (loaded / total) * 80;
              setProgress(loadProgress);
            }

            return { meta, blob, objectUrl } satisfies PreloadedImage;
          }),
        );

        if (!cancelled) {
          setPreloaded(preloadBatch);
          setIsComplete(true);
          setProgress(100);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to load gallery", error);
          // Still mark as complete on error so loading screen doesn't hang
          setIsComplete(true);
          setProgress(100);
        }
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, []);

  return { progress, isComplete, metas, preloaded };
}
