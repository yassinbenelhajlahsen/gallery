// src/hooks/useGalleryLoadingProgress.ts
import { useEffect, useState } from "react";
import type { ImageMeta, PreloadedImage } from "../services/storageService";
import { fetchAllImageMetadata } from "../services/storageService";

const PRELOAD_LIMIT = 999;

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

        // Instead of downloading thumbnail bytes and creating blob URLs,
        // simply record the thumbnail network URL so the browser can load
        // thumbnails via <img src="...">. This preserves the existing
        // visual behavior while avoiding manual byte handling.
        const total = Math.min(PRELOAD_LIMIT, allMetas.length);
        const targets = allMetas.slice(0, total);

        let loaded = 0;

        const preloadBatch = targets.map((meta) => {
          loaded++;
          if (!cancelled) {
            const loadProgress = 20 + (loaded / total) * 80;
            setProgress(loadProgress);
          }
          // Provide a placeholder blob to satisfy the shape; consumers
          // should prefer objectUrl which is the authoritative thumb URL.
          return {
            meta,
            blob: new Blob(),
            objectUrl: meta.thumbUrl,
          } as PreloadedImage;
        });

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
