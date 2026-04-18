// src/context/GalleryContext.tsx
/* eslint-disable react-refresh/only-export-components */
import type { PropsWithChildren } from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ImageMeta, PreloadedImage } from "../services/storageService";
import type { MediaMeta, VideoMeta } from "../types/mediaTypes";
import type { TimelineEvent } from "../components/timeline/TimelineEventItem";
import { fetchEvents } from "../services/eventsService";
import {
  fetchAllImageMetadata,
  fetchAllVideoMetadata,
} from "../services/storageService";
import {
  loadFromCache,
  loadVideoMetasFromCache,
  syncCache,
  clearCache,
  syncVideoThumbCache,
  loadVideoThumbUrlsFromCache,
  syncFullResCache,
  loadFullResUrlsFromCache,
} from "../services/mediaCacheService";
import { useAuth } from "./AuthContext";

type OpenModalOptions = {
  initialIndex?: number;
  imageId?: string;
  /** When true, the modal will preload full-res for ALL images (not just ±N window) */
  preloadAll?: boolean;
};

type GalleryContextValue = {
  /** Timeline events loaded from Firestore (loaded on app startup after auth) */
  events: TimelineEvent[];
  refreshEvents: () => Promise<void>;
  refreshGallery: () => Promise<void>;
  imageMetas: ImageMeta[];
  videoMetas: VideoMeta[];
  /** True once video metadata fetch has completed (success or failure). */
  isVideoMetadataReady: boolean;
  preloadedImages: PreloadedImage[];
  isGalleryLoading: boolean;
  hasGalleryLoadedOnce: boolean;
  loadError: string | null;
  loadingProgress: number;
  /** Resolves a thumbnail blob URL if cached, otherwise falls back to thumbUrl */
  resolveThumbUrl: (meta: ImageMeta) => string;
  /** Resolves a cached video thumbnail blob URL if present, otherwise falls back to thumbUrl */
  resolveVideoThumbUrl: (meta: VideoMeta) => string;
  /** Resolves a cached full-res blob URL if present, otherwise null */
  resolveFullResUrl: (meta: ImageMeta) => string | null;
  isModalOpen: boolean;
  /** Modal media (images only for most callers; timeline may mix images + videos) */
  modalMedia: MediaMeta[];
  modalInitialIndex: number;
  /** Whether the modal should preload ALL images (vs windowed ±N) */
  modalPreloadAll: boolean;
  openModalWithImages: (
    images: ImageMeta[],
    options?: OpenModalOptions,
  ) => void;
  openModalWithMedia: (media: MediaMeta[], options?: OpenModalOptions) => void;
  openModalForImageId: (imageId: string, collection?: ImageMeta[]) => void;
  closeModal: () => void;
  updateModalIndex: (index: number) => void;
};

const GalleryContext = createContext<GalleryContextValue | undefined>(
  undefined,
);

const releasePreloadedUrls = (items: PreloadedImage[]) => {
  if (typeof URL === "undefined" || typeof URL.revokeObjectURL !== "function") {
    return;
  }
  items.forEach((item) => {
    if (item.objectUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(item.objectUrl);
    }
  });
};

const releaseCachedUrlMap = (items: Map<string, string>) => {
  if (typeof URL === "undefined" || typeof URL.revokeObjectURL !== "function") {
    return;
  }
  items.forEach((url) => {
    if (url?.startsWith("blob:")) {
      URL.revokeObjectURL(url);
    }
  });
};

/**
 * Gates the "gallery is ready" signal behind three conditions:
 * 1. Fonts are parsed and ready (prevents Instrument Serif FOUT on first paint).
 * 2. Cached thumbnail blobs are decoded by the browser (no mid-load swap).
 * 3. A minimum 300ms has elapsed (ensures the loader is visible on cache hits).
 */
async function waitForReadinessGates(thumbUrls: string[]) {
  // Tests run in jsdom where document.fonts isn't implemented and a real
  // 3s timer would exceed the waitFor budget — skip the gate entirely.
  if (import.meta.env.MODE === "test") return;

  const fontsReady =
    typeof document !== "undefined" && document.fonts?.ready
      ? document.fonts.ready
      : Promise.resolve();

  const minShown = new Promise<void>((r) => setTimeout(r, 800));

  const imagesDecoded = Promise.all(
    thumbUrls.map((url) => {
      const img = new Image();
      img.src = url;
      return img.decode().catch(() => {});
    }),
  );

  await Promise.all([fontsReady, minShown, imagesDecoded]);
}

export const GalleryProvider = ({ children }: PropsWithChildren) => {
  const { user, initializing } = useAuth();
  const [imageMetas, setImageMetas] = useState<ImageMeta[]>([]);
  const [videoMetas, setVideoMetas] = useState<VideoMeta[]>([]);
  const [isVideoMetadataReady, setIsVideoMetadataReady] = useState(false);
  const [preloadedImages, setPreloadedImages] = useState<PreloadedImage[]>([]);
  const [videoThumbUrls, setVideoThumbUrls] = useState<Map<string, string>>(
    new Map(),
  );
  const [fullResBlobUrls, setFullResBlobUrls] = useState<Map<string, string>>(
    new Map(),
  );
  const [isGalleryLoading, setIsGalleryLoading] = useState(false);
  const [hasGalleryLoadedOnce, setHasGalleryLoadedOnce] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [modalMedia, setModalMedia] = useState<MediaMeta[]>([]);
  const [modalInitialIndex, setModalInitialIndex] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalPreloadAll, setModalPreloadAll] = useState(false);
  const [events, setEvents] = useState<TimelineEvent[]>([]);

  useEffect(() => {
    return () => {
      releasePreloadedUrls(preloadedImages);
    };
  }, [preloadedImages]);

  useEffect(() => {
    return () => {
      releaseCachedUrlMap(videoThumbUrls);
    };
  }, [videoThumbUrls]);

  useEffect(() => {
    return () => {
      releaseCachedUrlMap(fullResBlobUrls);
    };
  }, [fullResBlobUrls]);

  const warmFullResCache = useCallback(
    async (
      metas: ImageMeta[],
      opts?: { skipSync?: boolean; isCancelled?: () => boolean },
    ) => {
      try {
        if (!opts?.skipSync) await syncFullResCache(metas);
        const urls = await loadFullResUrlsFromCache(metas);
        if (opts?.isCancelled?.()) {
          releaseCachedUrlMap(urls);
          return;
        }
        setFullResBlobUrls((prev) => {
          releaseCachedUrlMap(prev);
          return urls;
        });
      } catch (err) {
        console.warn("[Gallery] Full-res cache warm failed:", err);
      }
    },
    [],
  );

  const resetState = useCallback(() => {
    setImageMetas([]);
    setVideoMetas([]);
    setIsVideoMetadataReady(false);
    setPreloadedImages([]);
    setVideoThumbUrls((prev) => {
      releaseCachedUrlMap(prev);
      return new Map();
    });
    setFullResBlobUrls((prev) => {
      releaseCachedUrlMap(prev);
      return new Map();
    });
    setHasGalleryLoadedOnce(false);
    setIsGalleryLoading(false);
    setLoadError(null);
    setLoadingProgress(0);
    setModalMedia([]);
    setModalInitialIndex(0);
    setIsModalOpen(false);
    setModalPreloadAll(false);
    setEvents([]);
    clearCache();
  }, []);

  useEffect(() => {
    if (initializing) {
      return;
    }

    if (!user) {
      resetState();
      return;
    }

    let cancelled = false;

    const run = async () => {
      // Fetch timeline events from Firestore early in the loading sequence so
      // the timeline is available app-wide shortly after auth becomes ready.
      // This call is intentionally non-blocking for the gallery metadata flow.
      (async () => {
        try {
          const docs = await fetchEvents();
          if (!cancelled)
            setEvents(
              docs.sort((a, b) => Date.parse(b.date) - Date.parse(a.date)),
            );
        } catch (err) {
          // Don't fail the entire gallery load if events can't be read.
          console.warn("[Gallery] Failed to load timeline events:", err);
          if (!cancelled) setEvents([]);
        }
      })();
      setIsGalleryLoading(true);
      setIsVideoMetadataReady(false);
      setLoadError(null);
      setLoadingProgress(0);

      try {
        let coldPathThumbUrls: string[] = [];

        // ── Phase 1: Instant restore from IndexedDB cache ──
        const [cached, cachedVideoMetas] = await Promise.all([
          loadFromCache(),
          loadVideoMetasFromCache(),
        ]);

        if (cached && cached.metas.length && !cancelled) {
          setImageMetas(cached.metas);
          setPreloadedImages(cached.preloaded);
          setLoadingProgress(100);

          // Hydrate in parallel with the readiness gates so the modal can
          // resolve cached blobs instantly on first open.
          warmFullResCache(cached.metas, {
            skipSync: true,
            isCancelled: () => cancelled,
          });

          // Gate the "ready" flip until fonts are parsed, blobs decoded, and
          // the loader has been visible for at least 300ms.
          await waitForReadinessGates(
            cached.preloaded.map((p) => p.objectUrl),
          );
          if (cancelled) return;
          setHasGalleryLoadedOnce(true);
        }

        if (cachedVideoMetas && cachedVideoMetas.length && !cancelled) {
          setVideoMetas(cachedVideoMetas);
        }

        // ── Phase 2: Fetch fresh metadata from Firebase ──
        const freshMetas = await fetchAllImageMetadata();
        if (cancelled) return;

        // Fire video metadata fetch in parallel with image cache sync — it has
        // no dependency on image data and is metadata-only (no bytes).
        const videoMetasFetch = fetchAllVideoMetadata();

        // If we had no cache, show the initial 20% progress
        if (!cached || !cached.metas.length) {
          setLoadingProgress(20);
        }

        if (!freshMetas.length) {
          setImageMetas([]);
          setPreloadedImages((prev) => {
            releasePreloadedUrls(prev);
            return [];
          });
        } else {
          // Update metas immediately so any new/removed images are reflected
          setImageMetas(freshMetas);

          // ── Phase 3: Diff-sync — download only NEW images ──
          const synced = await syncCache(freshMetas, (loaded, total) => {
            if (cancelled) return;
            // If we already showed the gallery from cache, keep progress at 100
            if (cached && cached.metas.length) return;
            const progress = 20 + (loaded / total) * 80;
            setLoadingProgress(progress);
          });

          if (cancelled) {
            // Release any object URLs we just created
            releasePreloadedUrls(synced);
            return;
          }

          coldPathThumbUrls = synced.map((p) => p.objectUrl);

          // Release old preloaded URLs before replacing
          setPreloadedImages((prev) => {
            releasePreloadedUrls(prev);
            return synced;
          });

          // Do NOT await — warming must never gate the "ready" flip or
          // interfere with video metadata/thumb sync.
          warmFullResCache(freshMetas, { isCancelled: () => cancelled });
        }

        // ── Phase 4: Await video metadata (already in-flight since Phase 2) ──
        try {
          const freshVideoMetas = await videoMetasFetch;
          if (cancelled) return;
          setVideoMetas(freshVideoMetas);
          setIsVideoMetadataReady(true);

          // Hydrate any already-cached video thumbs for immediate use.
          const cachedThumbUrls = await loadVideoThumbUrlsFromCache(
            freshVideoMetas,
          );
          if (cancelled) {
            releaseCachedUrlMap(cachedThumbUrls);
            return;
          }
          setVideoThumbUrls((prev) => {
            releaseCachedUrlMap(prev);
            return cachedThumbUrls;
          });

          // Cache ONLY video thumbnail JPEGs, then re-hydrate so newly cached
          // entries are available in state.
          await syncVideoThumbCache(freshVideoMetas);
          if (cancelled) return;
          const syncedThumbUrls = await loadVideoThumbUrlsFromCache(
            freshVideoMetas,
          );
          if (cancelled) {
            releaseCachedUrlMap(syncedThumbUrls);
            return;
          }
          setVideoThumbUrls((prev) => {
            releaseCachedUrlMap(prev);
            return syncedThumbUrls;
          });
        } catch (videoErr) {
          console.warn("[Gallery] Failed to load video metadata", videoErr);
          if (!cancelled) {
            setVideoMetas([]);
            setIsVideoMetadataReady(true);
            setVideoThumbUrls((prev) => {
              releaseCachedUrlMap(prev);
              return new Map();
            });
          }
        }

        setLoadingProgress(100);
        await waitForReadinessGates(coldPathThumbUrls);
        if (cancelled) return;
        setHasGalleryLoadedOnce(true);
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to load gallery", error);
          setLoadError(
            error instanceof Error ? error.message : "Failed to load gallery",
          );
          setHasGalleryLoadedOnce(true);
          setIsVideoMetadataReady(true);
          setLoadingProgress(100);
        }
      } finally {
        if (!cancelled) {
          setIsGalleryLoading(false);
        }
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [initializing, resetState, user, warmFullResCache]);

  const resolveThumbUrl = useCallback(
    (meta: ImageMeta) =>
      preloadedImages.find((item) => item.meta.id === meta.id)?.objectUrl ??
      meta.thumbUrl,
    [preloadedImages],
  );

  const resolveVideoThumbUrl = useCallback((meta: VideoMeta) => {
    return videoThumbUrls.get(meta.id) ?? meta.thumbUrl;
  }, [videoThumbUrls]);

  const resolveFullResUrl = useCallback(
    (meta: ImageMeta) => fullResBlobUrls.get(meta.id) ?? null,
    [fullResBlobUrls],
  );

  const openModalWithImages = useCallback(
    (images: ImageMeta[], options?: OpenModalOptions) => {
      if (!images.length) return;
      const safeImages = images.map(
        (img) => ({ ...img, type: "image" }) as const,
      );
      const providedIndex = options?.initialIndex ?? 0;
      let index = providedIndex;
      if (options?.imageId) {
        const found = safeImages.findIndex((img) => img.id === options.imageId);
        if (found >= 0) {
          index = found;
        }
      }
      const clampedIndex = Math.min(Math.max(index, 0), safeImages.length - 1);
      setModalMedia(safeImages);
      setModalInitialIndex(clampedIndex);
      setModalPreloadAll(options?.preloadAll ?? false);
      setIsModalOpen(true);
    },
    [],
  );

  const openModalWithMedia = useCallback(
    (media: MediaMeta[], options?: OpenModalOptions) => {
      if (!media.length) return;
      const safeMedia = [...media];
      const providedIndex = options?.initialIndex ?? 0;
      let index = providedIndex;
      if (options?.imageId) {
        const found = safeMedia.findIndex((m) => m.id === options.imageId);
        if (found >= 0) index = found;
      }
      const clampedIndex = Math.min(Math.max(index, 0), safeMedia.length - 1);
      setModalMedia(safeMedia);
      setModalInitialIndex(clampedIndex);
      // Preload flag applies to images only; modal will ignore for videos.
      setModalPreloadAll(options?.preloadAll ?? false);
      setIsModalOpen(true);
    },
    [],
  );

  const openModalForImageId = useCallback(
    (imageId: string, collection?: ImageMeta[]) => {
      if (!imageId) return;
      const source = collection && collection.length ? collection : imageMetas;
      if (!source.length) return;
      const index = source.findIndex((meta) => meta.id === imageId);
      openModalWithImages(source, {
        initialIndex: index >= 0 ? index : 0,
      });
    },
    [imageMetas, openModalWithImages],
  );

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
  }, []);

  const updateModalIndex = useCallback((index: number) => {
    setModalInitialIndex(index);
  }, []);

  const refreshEvents = useCallback(async () => {
    try {
      const docs = await fetchEvents();
      setEvents(docs.sort((a, b) => Date.parse(b.date) - Date.parse(a.date)));
    } catch (err) {
      console.error("Failed to refresh events:", err);
    }
  }, []);

  const refreshGallery = useCallback(async () => {
    try {
      setIsGalleryLoading(true);
      setIsVideoMetadataReady(false);
      setLoadError(null);

      // Fetch fresh metadata from Firebase
      const freshMetas = await fetchAllImageMetadata();
      if (!freshMetas.length) {
        setImageMetas([]);
        setPreloadedImages((prev) => {
          releasePreloadedUrls(prev);
          return [];
        });
      } else {
        // Update metas immediately
        setImageMetas(freshMetas);

        // Diff-sync cache
        const synced = await syncCache(freshMetas, () => {});
        setPreloadedImages((prev) => {
          releasePreloadedUrls(prev);
          return synced;
        });

        warmFullResCache(freshMetas);
      }

      // Fetch video metadata
      try {
        const freshVideoMetas = await fetchAllVideoMetadata();
        setVideoMetas(freshVideoMetas);
        setIsVideoMetadataReady(true);
        const cachedThumbUrls = await loadVideoThumbUrlsFromCache(freshVideoMetas);
        setVideoThumbUrls((prev) => {
          releaseCachedUrlMap(prev);
          return cachedThumbUrls;
        });
        await syncVideoThumbCache(freshVideoMetas);
        const syncedThumbUrls = await loadVideoThumbUrlsFromCache(
          freshVideoMetas,
        );
        setVideoThumbUrls((prev) => {
          releaseCachedUrlMap(prev);
          return syncedThumbUrls;
        });
      } catch (videoErr) {
        console.warn("[Gallery] Failed to load video metadata", videoErr);
        setVideoMetas([]);
        setIsVideoMetadataReady(true);
        setVideoThumbUrls((prev) => {
          releaseCachedUrlMap(prev);
          return new Map();
        });
      }

      setHasGalleryLoadedOnce(true);
    } catch (error) {
      console.error("Failed to refresh gallery", error);
      setLoadError(
        error instanceof Error ? error.message : "Failed to refresh gallery",
      );
    } finally {
      setIsGalleryLoading(false);
    }
  }, [warmFullResCache]);

  const value = useMemo(
    () => ({
      events,
      refreshEvents,
      refreshGallery,
      imageMetas,
      videoMetas,
      isVideoMetadataReady,
      preloadedImages,
      isGalleryLoading,
      hasGalleryLoadedOnce,
      loadError,
      loadingProgress,
      resolveThumbUrl,
      resolveVideoThumbUrl,
      resolveFullResUrl,
      isModalOpen,
      modalMedia,
      modalInitialIndex,
      modalPreloadAll,
      openModalWithImages,
      openModalWithMedia,
      openModalForImageId,
      closeModal,
      updateModalIndex,
    }),
    [
      events,
      refreshEvents,
      refreshGallery,
      imageMetas,
      videoMetas,
      isVideoMetadataReady,
      preloadedImages,
      isGalleryLoading,
      hasGalleryLoadedOnce,
      loadError,
      loadingProgress,
      resolveThumbUrl,
      resolveVideoThumbUrl,
      resolveFullResUrl,
      isModalOpen,
      modalMedia,
      modalInitialIndex,
      modalPreloadAll,
      openModalWithImages,
      openModalWithMedia,
      openModalForImageId,
      closeModal,
      updateModalIndex,
    ],
  );

  return (
    <GalleryContext.Provider value={value}>{children}</GalleryContext.Provider>
  );
};

export const useGallery = () => {
  const context = useContext(GalleryContext);
  if (!context) {
    throw new Error("useGallery must be used within a GalleryProvider");
  }
  return context;
};
