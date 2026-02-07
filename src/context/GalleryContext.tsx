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
import type { MediaMeta, VideoMeta } from "../services/mediaTypes";
import type { TimelineEvent } from "../components/TimelineEventItem";
import { fetchEvents } from "../services/eventsService";
import {
  fetchAllImageMetadata,
  fetchAllVideoMetadata,
} from "../services/storageService";
import {
  loadFromCache,
  syncCache,
  clearCache,
  syncVideoThumbCache,
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
  preloadedImages: PreloadedImage[];
  isGalleryLoading: boolean;
  hasGalleryLoadedOnce: boolean;
  loadError: string | null;
  loadingProgress: number;
  /** Resolves a thumbnail blob URL if cached, otherwise falls back to thumbUrl */
  resolveThumbUrl: (meta: ImageMeta) => string;
  /** Resolves a cached video thumbnail blob URL if present, otherwise falls back to thumbUrl */
  resolveVideoThumbUrl: (meta: VideoMeta) => string;
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

export const GalleryProvider = ({ children }: PropsWithChildren) => {
  const { user, initializing } = useAuth();
  const [imageMetas, setImageMetas] = useState<ImageMeta[]>([]);
  const [videoMetas, setVideoMetas] = useState<VideoMeta[]>([]);
  const [preloadedImages, setPreloadedImages] = useState<PreloadedImage[]>([]);
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

  const resetState = useCallback(() => {
    setImageMetas([]);
    setVideoMetas([]);
    setPreloadedImages([]);
    setHasGalleryLoadedOnce(false);
    setIsGalleryLoading(false);
    setLoadError(null);
    setLoadingProgress(0);
    setModalMedia([]);
    setModalInitialIndex(0);
    setIsModalOpen(false);
    setModalPreloadAll(false);
    // Clear the IndexedDB cache on logout
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
      setLoadError(null);
      setLoadingProgress(0);

      try {
        // ── Phase 1: Instant restore from IndexedDB cache ──
        const cached = await loadFromCache();

        if (cached && cached.metas.length && !cancelled) {
          setImageMetas(cached.metas);
          setPreloadedImages(cached.preloaded);
          setHasGalleryLoadedOnce(true);
          setLoadingProgress(100);
        }

        // ── Phase 2: Fetch fresh metadata from Firebase ──
        const freshMetas = await fetchAllImageMetadata();
        if (cancelled) return;

        if (!freshMetas.length) {
          setImageMetas([]);
          setPreloadedImages([]);
          setHasGalleryLoadedOnce(true);
          setLoadingProgress(100);
          return;
        }

        // Update metas immediately so any new/removed images are reflected
        setImageMetas(freshMetas);

        // If we had no cache, show the initial 20% progress
        if (!cached || !cached.metas.length) {
          setLoadingProgress(20);
        }

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

        // Release old preloaded URLs before replacing
        setPreloadedImages((prev) => {
          releasePreloadedUrls(prev);
          return synced;
        });
        setHasGalleryLoadedOnce(true);
        setLoadingProgress(100);

        // ── Phase 4: Fetch video metadata (metadata only; no video bytes) ──
        try {
          const freshVideoMetas = await fetchAllVideoMetadata();
          if (cancelled) return;
          setVideoMetas(freshVideoMetas);
          // Cache ONLY video thumbnail JPEGs
          await syncVideoThumbCache(freshVideoMetas);
        } catch (videoErr) {
          console.warn("[Gallery] Failed to load video metadata", videoErr);
          if (!cancelled) setVideoMetas([]);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to load gallery", error);
          setLoadError(
            error instanceof Error ? error.message : "Failed to load gallery",
          );
          setHasGalleryLoadedOnce(true);
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
  }, [initializing, resetState, user]);

  const resolveThumbUrl = useCallback(
    (meta: ImageMeta) =>
      preloadedImages.find((item) => item.meta.id === meta.id)?.objectUrl ??
      meta.thumbUrl,
    [preloadedImages],
  );

  const resolveVideoThumbUrl = useCallback((meta: VideoMeta) => {
    // For now, we intentionally don't restore cached video thumbs into React state.
    // We still return the network URL which browser may cache, but we avoid any
    // explicit in-memory retention in app-owned state.
    return meta.thumbUrl;
  }, []);

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
      setLoadError(null);

      // Fetch fresh metadata from Firebase
      const freshMetas = await fetchAllImageMetadata();
      if (!freshMetas.length) {
        setImageMetas([]);
        setPreloadedImages([]);
        setHasGalleryLoadedOnce(true);
        return;
      }

      // Update metas immediately
      setImageMetas(freshMetas);

      // Diff-sync cache
      const synced = await syncCache(freshMetas, () => {});
      setPreloadedImages((prev) => {
        releasePreloadedUrls(prev);
        return synced;
      });

      // Fetch video metadata
      try {
        const freshVideoMetas = await fetchAllVideoMetadata();
        setVideoMetas(freshVideoMetas);
        await syncVideoThumbCache(freshVideoMetas);
      } catch (videoErr) {
        console.warn("[Gallery] Failed to load video metadata", videoErr);
        setVideoMetas([]);
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
  }, []);

  const value = useMemo(
    () => ({
      events,
      refreshEvents,
      refreshGallery,
      imageMetas,
      videoMetas,
      preloadedImages,
      isGalleryLoading,
      hasGalleryLoadedOnce,
      loadError,
      loadingProgress,
      resolveThumbUrl,
      resolveVideoThumbUrl,
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
      preloadedImages,
      isGalleryLoading,
      hasGalleryLoadedOnce,
      loadError,
      loadingProgress,
      resolveThumbUrl,
      resolveVideoThumbUrl,
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
