// src/hooks/useVideoPrefetch.ts
import { useEffect, useRef, useState } from "react";
import type { MediaMeta, VideoMeta } from "../types/mediaTypes";
import { isVideoMeta } from "../types/mediaTypes";
import { getVideoDownloadUrl } from "../services/storageService";

const BYTE_BUDGET = 2 * 1024 * 1024; // 2 MB per neighbour — enough for initial playback
const MAX_CONCURRENT = 2;
const PREFETCH_WINDOW = 3; // Videos page: ±this many indices around active
const EVENT_CAP_DESKTOP = 10;
const EVENT_CAP_MOBILE = 3;

// Decoder-warmup pool rendered as hidden off-screen <video> elements (desktop only).
export const VIDEO_BOOSTER_POOL_SIZE = 4;

interface UseVideoPrefetchOptions {
  media: MediaMeta[];
  dataIndex: number;
  isOpen: boolean;
  preloadAll: boolean;
  isMobile: boolean;
}

export interface UseVideoPrefetchResult {
  prefetchedUrls: Map<string, string>; // videoId → resolved download URL
}

export function useVideoPrefetch({
  media,
  dataIndex,
  isOpen,
  preloadAll,
  isMobile,
}: UseVideoPrefetchOptions): UseVideoPrefetchResult {
  const [prefetchedUrls, setPrefetchedUrls] = useState<Map<string, string>>(
    new Map(),
  );

  // Ref mirror of prefetchedUrls state — used for O(1) "already done" checks
  // inside async callbacks without stale-closure risk.
  const urlsRef = useRef<Map<string, string>>(new Map());

  const controllersRef = useRef<Map<string, AbortController>>(new Map());
  const inFlightIdsRef = useRef<Set<string>>(new Set());
  const pendingRef = useRef<VideoMeta[]>([]);
  const activeSlotsRef = useRef<number>(0);
  // Incremented whenever we abort all in-flight work so stale async callbacks bail out
  const resetTokenRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);
  // Stored in a ref so async run() callbacks always call the latest version
  const processPendingRef = useRef<() => void>(() => {});

  processPendingRef.current = () => {
    while (
      activeSlotsRef.current < MAX_CONCURRENT &&
      pendingRef.current.length > 0
    ) {
      const meta = pendingRef.current.shift()!;
      if (!meta.videoPath) continue;
      if (inFlightIdsRef.current.has(meta.id)) continue;

      activeSlotsRef.current++;
      inFlightIdsRef.current.add(meta.id);

      const controller = new AbortController();
      controllersRef.current.set(meta.id, controller);
      const resetAtLaunch = resetTokenRef.current;

      const run = async () => {
        try {
          const url = await getVideoDownloadUrl(meta.videoPath);
          if (controller.signal.aborted) return;

          urlsRef.current.set(meta.id, url);
          setPrefetchedUrls((prev) => {
            if (prev.has(meta.id)) return prev;
            const next = new Map(prev);
            next.set(meta.id, url);
            return next;
          });

          // Warm the HTTP disk cache with a Range request for the first BYTE_BUDGET bytes.
          // When the real <video> element later fetches the same URL, those bytes are
          // served from the HTTP cache, eliminating the initial buffering wait.
          const resp = await fetch(url, {
            headers: { Range: `bytes=0-${BYTE_BUDGET - 1}` },
            signal: controller.signal,
          });
          if (!controller.signal.aborted) {
            // Drain the body so the browser commits the partial response to disk cache
            await resp.arrayBuffer();
          }
        } catch (err) {
          if (!(err instanceof DOMException && err.name === "AbortError")) {
            console.warn("[videoPrefetch] Failed to prefetch video", meta.id, err);
          }
        } finally {
          // Only update shared state if this run hasn't been superseded by a reset.
          // Resets happen on modal close and unmount (see mount-only effect below).
          if (resetTokenRef.current === resetAtLaunch) {
            activeSlotsRef.current = Math.max(0, activeSlotsRef.current - 1);
            inFlightIdsRef.current.delete(meta.id);
            controllersRef.current.delete(meta.id);
            processPendingRef.current();
          }
        }
      };

      run();
    }
  };

  // Mount-only effect: full teardown on unmount so in-flight async callbacks don't
  // touch state after the component has unmounted.
  // Capture the ref objects (not .current) so react-hooks/exhaustive-deps is satisfied
  // while still reading current values at cleanup time — the intended behaviour.
  useEffect(() => {
    const raf = rafRef;
    const resetToken = resetTokenRef;
    const controllers = controllersRef;
    const inFlight = inFlightIdsRef;
    const pending = pendingRef;
    const activeSlots = activeSlotsRef;
    return () => {
      if (raf.current != null) {
        cancelAnimationFrame(raf.current);
        raf.current = null;
      }
      resetToken.current++;
      for (const [, ctrl] of controllers.current) ctrl.abort();
      controllers.current.clear();
      inFlight.current.clear();
      pending.current = [];
      activeSlots.current = 0;
    };
  }, []);

  useEffect(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    if (!isOpen || !media.length) {
      // Full reset when modal closes: clear URL state too
      resetTokenRef.current++;
      for (const [, ctrl] of controllersRef.current) ctrl.abort();
      controllersRef.current.clear();
      inFlightIdsRef.current.clear();
      pendingRef.current = [];
      activeSlotsRef.current = 0;
      urlsRef.current.clear();
      setPrefetchedUrls(new Map());
      return;
    }

    // Debounce: run window recompute on the next frame to avoid thrashing
    // the fetch queue on rapid swipes.
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;

      const activeId = media[dataIndex]?.id;
      const cap = isMobile ? EVENT_CAP_MOBILE : EVENT_CAP_DESKTOP;

      let wantedMetas: VideoMeta[];

      if (preloadAll) {
        // All video items, sorted nearest-to-active first, capped at EVENT_CAP
        const candidates: { meta: VideoMeta; distance: number }[] = [];
        media.forEach((item, i) => {
          if (isVideoMeta(item) && item.id !== activeId) {
            candidates.push({ meta: item, distance: Math.abs(i - dataIndex) });
          }
        });
        candidates.sort((a, b) => a.distance - b.distance);
        wantedMetas = candidates.slice(0, cap).map(({ meta }) => meta);
      } else {
        // Windowed: ±PREFETCH_WINDOW indices around dataIndex
        wantedMetas = [];
        for (
          let offset = -PREFETCH_WINDOW;
          offset <= PREFETCH_WINDOW;
          offset++
        ) {
          if (offset === 0) continue;
          const idx = dataIndex + offset;
          if (idx < 0 || idx >= media.length) continue;
          const item = media[idx];
          if (isVideoMeta(item) && item.id !== activeId) {
            wantedMetas.push(item);
          }
        }
      }

      const wantedIds = new Set(wantedMetas.map((m) => m.id));

      // Remove out-of-window items from the pending queue
      pendingRef.current = pendingRef.current.filter((m) => wantedIds.has(m.id));

      // Abort in-flight items that left the window
      for (const [id, ctrl] of controllersRef.current) {
        if (!wantedIds.has(id)) {
          ctrl.abort();
          controllersRef.current.delete(id);
          inFlightIdsRef.current.delete(id);
        }
      }

      // Evict stale URLs from the ref mirror and the React state
      for (const [id] of urlsRef.current) {
        if (!wantedIds.has(id)) urlsRef.current.delete(id);
      }
      setPrefetchedUrls((prev) => {
        let changed = false;
        const next = new Map(prev);
        for (const [id] of prev) {
          if (!wantedIds.has(id)) {
            next.delete(id);
            changed = true;
          }
        }
        return changed ? next : prev;
      });

      // Enqueue items not already done, in-flight, or pending
      for (const meta of wantedMetas) {
        if (
          !urlsRef.current.has(meta.id) &&
          !inFlightIdsRef.current.has(meta.id) &&
          !pendingRef.current.some((m) => m.id === meta.id)
        ) {
          pendingRef.current.push(meta);
        }
      }

      processPendingRef.current();
    });

    // Cleanup: only cancel the pending RAF on dep change.
    // Do NOT abort controllers — the window recompute above already performs
    // scoped aborts for items that left the window. Aborting everything here
    // would cancel still-wanted in-flight fetches on every swipe.
    return () => {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [dataIndex, isOpen, media, preloadAll, isMobile]);

  return { prefetchedUrls };
}
