// src/hooks/useVideoPagePrefetch.ts
import { useEffect, useRef } from "react";
import type { VideoMeta } from "../types/mediaTypes";
import { getVideoDownloadUrl } from "../services/storageService";

const BYTE_BUDGET = 2 * 1024 * 1024; // 2 MB — same budget as the modal-level hook
const MAX_CONCURRENT = 2;
// Expand the intersection zone 600px beyond the viewport on all sides.
// At typical tile heights (~170px for a 4-column grid) this covers ≈3–4 rows
// above and below the visible area, matching the "±3 rows" prefetch intent.
const ROOT_MARGIN = "600px";

export function useVideoPagePrefetch(videoMetas: VideoMeta[]): void {
  // IDs already queued or completed — prevents double-fetch across observer re-runs
  const prefetchedRef = useRef<Set<string>>(new Set());
  const controllersRef = useRef<Map<string, AbortController>>(new Map());
  const activeSlotsRef = useRef<number>(0);
  const pendingRef = useRef<VideoMeta[]>([]);
  // Updated every render so the observer callback always sees the current list
  const videoMetasRef = useRef(videoMetas);
  videoMetasRef.current = videoMetas;

  // Stored in a ref so the async finally callbacks always call the latest version
  const processPendingRef = useRef<() => void>(() => {});
  processPendingRef.current = () => {
    while (
      activeSlotsRef.current < MAX_CONCURRENT &&
      pendingRef.current.length > 0
    ) {
      const meta = pendingRef.current.shift()!;
      if (!meta.videoPath || controllersRef.current.has(meta.id)) continue;

      activeSlotsRef.current++;
      const controller = new AbortController();
      controllersRef.current.set(meta.id, controller);

      (async () => {
        try {
          // getVideoDownloadUrl is session-cached in storageService — no extra
          // Firebase round-trip if the modal has already resolved this URL.
          const url = await getVideoDownloadUrl(meta.videoPath);
          if (controller.signal.aborted) return;

          // Warm the HTTP disk cache so the modal's <video> element gets the
          // first chunk instantly from cache instead of waiting on the network.
          const resp = await fetch(url, {
            headers: { Range: `bytes=0-${BYTE_BUDGET - 1}` },
            signal: controller.signal,
          });
          if (!controller.signal.aborted) await resp.arrayBuffer();
        } catch (err) {
          if ((err as Error)?.name !== "AbortError") {
            console.warn("[videoPagePrefetch] Failed to prefetch video", err);
          }
        } finally {
          activeSlotsRef.current = Math.max(0, activeSlotsRef.current - 1);
          controllersRef.current.delete(meta.id);
          processPendingRef.current();
        }
      })();
    }
  };

  useEffect(() => {
    if (!videoMetas.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        let added = false;
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const videoId = (entry.target as HTMLElement).dataset.videoId;
          if (!videoId || prefetchedRef.current.has(videoId)) continue;

          const meta = videoMetasRef.current.find((m) => m.id === videoId);
          if (!meta) continue;

          prefetchedRef.current.add(videoId);
          pendingRef.current.push(meta);
          added = true;
        }
        if (added) processPendingRef.current();
      },
      { rootMargin: ROOT_MARGIN },
    );

    document
      .querySelectorAll<HTMLElement>("[data-video-id]")
      .forEach((el) => observer.observe(el));

    return () => observer.disconnect();
    // Re-run when the list grows (initial async load) so newly rendered tiles
    // are observed. prefetchedRef persists across re-runs, so already-queued
    // items are skipped.
  }, [videoMetas.length]);

  // Mount-only cleanup: abort everything when the page unmounts
  useEffect(() => {
    const controllers = controllersRef;
    const pending = pendingRef;
    const prefetched = prefetchedRef;
    const activeSlots = activeSlotsRef;
    return () => {
      for (const [, ctrl] of controllers.current) ctrl.abort();
      controllers.current.clear();
      pending.current = [];
      prefetched.current.clear();
      activeSlots.current = 0;
    };
  }, []);
}
