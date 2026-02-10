// src/components/mediaModalViewer.tsx
import React from "react";
import type { ImageMeta } from "../services/storageService";
import type { ImageMediaMeta, MediaMeta, VideoMeta } from "../types/mediaTypes";
import { getVideoDownloadUrl } from "../services/storageService";

const isVideoMeta = (item: MediaMeta | undefined): item is VideoMeta =>
  Boolean(item && (item as VideoMeta).type === "video");

const isImageMeta = (item: MediaMeta | undefined): item is ImageMediaMeta =>
  Boolean(item && !isVideoMeta(item));

export type ImageModalViewerProps = {
  media: MediaMeta[];
  initialIndex?: number;
  isOpen: boolean;
  onClose: () => void;
  onChangeIndex?: (nextIndex: number) => void;
  /** Resolves a cached thumbnail blob URL for an image (used as placeholder) */
  resolveThumbUrl?: (image: ImageMeta) => string;
  /** Resolves a cached thumbnail blob URL for a video (used for poster) */
  resolveVideoThumbUrl?: (video: VideoMeta) => string;
  /** When true, preload full-res for ALL images instead of only the ±N window */
  preloadAll?: boolean;
};

const clampIndex = (index: number, length: number) => {
  if (length === 0) return 0;
  if (index < 0) return length - 1;
  if (index >= length) return 0;
  return index;
};

const toLocalDate = (dateString: string) => {
  if (!dateString) return new Date(0);

  const trimmed = dateString.trim();

  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch.map(Number);
    return new Date(year, (month ?? 1) - 1, day ?? 1);
  }

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
    const [month, day, year] = trimmed.split("/").map(Number);
    return new Date(year ?? 0, (month ?? 1) - 1, day ?? 1);
  }

  return new Date(trimmed);
};

const ImageModalViewer: React.FC<ImageModalViewerProps> = ({
  media,
  initialIndex = 0,
  isOpen,
  onClose,
  onChangeIndex,
  resolveThumbUrl,
  resolveVideoThumbUrl,
  preloadAll = false,
}) => {
  const [activeIndex, setActiveIndex] = React.useState(initialIndex);
  const [isAnimating, setIsAnimating] = React.useState(false);
  const [isClosing, setIsClosing] = React.useState(false);
  const [hasInitialized, setHasInitialized] = React.useState(false);
  const touchStartX = React.useRef<number | null>(null);
  const animationTimeoutRef = React.useRef<number | null>(null);

  // ── Full-res URL management ──
  // Map of image id → full-res blob URL (only for the windowed preload area)
  const [fullResUrls, setFullResUrls] = React.useState<Map<string, string>>(
    new Map(),
  );
  const loadingIdsRef = React.useRef<Set<string>>(new Set());

  // ── Video URL (remote URL) management ──
  // We keep only a single active video URL (Firebase download URL) and let
  // the browser stream it. No blob/object URL creation.
  const [activeVideoUrl, setActiveVideoUrl] = React.useState<string | null>(
    null,
  );
  const videoElRef = React.useRef<HTMLVideoElement | null>(null);
  const videoLoadTokenRef = React.useRef(0);

  const cleanupVideo = React.useCallback(() => {
    const el = videoElRef.current;
    if (el) {
      try {
        el.pause();
        el.removeAttribute("src");
        el.load();
      } catch {
        // ignore
      }
    }
    videoElRef.current = null;

    // We no longer create blob URLs for video; just clear the stored URL.
    setActiveVideoUrl(null);
  }, []);

  const isMobile =
    window.innerWidth < 640 || navigator.connection?.saveData === true;

  const PRELOAD_AHEAD = isMobile ? 3 : 10;
  const PRELOAD_BEHIND = isMobile ? 2 : 5;

  const SLIDE_DURATION = 300;
  const totalItems = media.length;

  const clearAnimationTimeout = () => {
    if (animationTimeoutRef.current != null) {
      window.clearTimeout(animationTimeoutRef.current);
      animationTimeoutRef.current = null;
    }
  };

  // Reset state when modal closes completely
  React.useEffect(() => {
    if (!isOpen) {
      const timer = setTimeout(() => {
        setActiveIndex(0);
        setIsAnimating(false);
        setIsClosing(false);
        setHasInitialized(false);
        // Clear stored full-res URLs and active video URL. We no longer
        // create blob object URLs for media; the browser will load the
        // Firebase download URLs directly.
        setFullResUrls(new Map());
        setActiveVideoUrl(null);
        loadingIdsRef.current.clear();
        clearAnimationTimeout();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Initialize index when opening
  React.useEffect(() => {
    if (isOpen) {
      const safeIndex = clampIndex(initialIndex, media.length);
      setActiveIndex(safeIndex);
      setIsClosing(false);
      // Set initialized flag after a brief delay to allow DOM to settle
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setHasInitialized(true);
        });
      });
    }
  }, [initialIndex, isOpen, media.length]);

  const currentItem = media[activeIndex];

  // Fetch video bytes ONLY when a video becomes active (after user opened modal)
  React.useEffect(() => {
    if (!isOpen) return;

    if (!isVideoMeta(currentItem)) {
      // If we moved away from a video, ensure it's fully cleaned up.
      cleanupVideo();
      return;
    }

    // New active video: cleanup any previous video first.
    cleanupVideo();

    const token = ++videoLoadTokenRef.current;
    let cancelled = false;

    const run = async () => {
      try {
        // Resolve a downloadable URL and let the browser stream it.
        const url = await getVideoDownloadUrl(currentItem.videoPath);
        if (cancelled || token !== videoLoadTokenRef.current) return;
        setActiveVideoUrl(url);
      } catch (err) {
        console.warn("[Modal] Failed to load video", err);
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [cleanupVideo, currentItem, isOpen]);

  // ── Full-res windowed preloading ──
  // Load full-res for the active image + window, or ALL if preloadAll is set.
  // Evict any blob URLs outside the window (only when not preloadAll).
  React.useEffect(() => {
    if (!isOpen || !media.length) return;

    // Map media index -> image index for preloading window, keeping behavior for images-only modals.
    // In mixed modals, we only preload images that are in-window AND are images.
    const wantedMediaIndices = new Set<number>();
    if (preloadAll) {
      for (let i = 0; i < media.length; i++) wantedMediaIndices.add(i);
    } else {
      for (let offset = -PRELOAD_BEHIND; offset <= PRELOAD_AHEAD; offset++) {
        const idx = activeIndex + offset;
        if (idx >= 0 && idx < media.length) wantedMediaIndices.add(idx);
      }
    }

    const wantedImageIds = new Set<string>();
    wantedMediaIndices.forEach((idx) => {
      const item = media[idx];
      if (isImageMeta(item)) wantedImageIds.add(item.id);
    });

    // Evict entries outside the window (we store download URLs only)
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

    // Clean loadingIdsRef for evicted images so they can be re-fetched
    for (const id of loadingIdsRef.current) {
      if (!wantedImageIds.has(id)) {
        loadingIdsRef.current.delete(id);
      }
    }

    // Start loading wanted images that aren't already loaded or in-flight
    wantedMediaIndices.forEach((idx) => {
      const item = media[idx];
      if (!isImageMeta(item)) return;
      const img = item;
      if (loadingIdsRef.current.has(img.id)) return;

      loadingIdsRef.current.add(img.id);

      // Instead of fetching bytes, record the download URL so the
      // browser can load it directly when the <img> is rendered.
      setFullResUrls((prev) => {
        if (prev.has(img.id)) return prev;
        const next = new Map(prev);
        next.set(img.id, img.downloadUrl);
        return next;
      });
      loadingIdsRef.current.delete(img.id);
    });
  }, [activeIndex, isOpen, media, preloadAll, PRELOAD_AHEAD, PRELOAD_BEHIND]);

  const goToIndex = React.useCallback(
    (next: number, _direction?: "left" | "right", immediate = false) => {
      if (!media.length) return;

      const safeIndex = clampIndex(next, media.length);
      if (safeIndex === activeIndex && !immediate) return;

      if (immediate) {
        setActiveIndex(safeIndex);
        onChangeIndex?.(safeIndex);
        return;
      }

      setIsAnimating(true);
      setActiveIndex(safeIndex);
      onChangeIndex?.(safeIndex);

      clearAnimationTimeout();
      animationTimeoutRef.current = window.setTimeout(() => {
        setIsAnimating(false);
        animationTimeoutRef.current = null;
      }, SLIDE_DURATION);
    },
    [SLIDE_DURATION, activeIndex, media.length, onChangeIndex],
  );

  React.useEffect(() => {
    return () => {
      clearAnimationTimeout();
    };
  }, []);

  const goToNext = React.useCallback(() => {
    goToIndex(activeIndex + 1, "left");
  }, [activeIndex, goToIndex]);

  const goToPrev = React.useCallback(() => {
    goToIndex(activeIndex - 1, "right");
  }, [activeIndex, goToIndex]);

  const handleClose = React.useCallback(() => {
    setIsClosing(true);
    // Let the layout effect handle background reset when isOpen changes
    setTimeout(() => {
      onClose();
    }, 200);
  }, [onClose]);

  React.useEffect(() => {
    if (!isOpen) return;

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        handleClose();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        goToNext();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        goToPrev();
      }
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [goToNext, goToPrev, handleClose, isOpen]);

  // Use layout effect to set background BEFORE paint, ensuring consistent timing
  React.useLayoutEffect(() => {
    if (isOpen) {
      // Set dark background synchronously before browser paints
      document.documentElement.style.backgroundColor = "#000";
      document.body.style.backgroundColor = "#000";
      document.body.style.overflow = "hidden";
    } else {
      // Reset immediately when closing
      document.documentElement.style.backgroundColor = "";
      document.body.style.backgroundColor = "";
      document.body.style.overflow = "";
    }
  }, [isOpen]);
  const handleBackdropClick = (event: React.MouseEvent) => {
    if (event.target === event.currentTarget) {
      handleClose();
    }
  };

  const handleTouchStart = (event: React.TouchEvent) => {
    touchStartX.current = event.touches[0]?.clientX ?? null;
  };

  const handleTouchEnd = (event: React.TouchEvent) => {
    if (touchStartX.current == null) return;
    const deltaX =
      (event.changedTouches[0]?.clientX ?? 0) - touchStartX.current;
    const threshold = 50;
    if (deltaX > threshold) {
      goToPrev();
    } else if (deltaX < -threshold) {
      goToNext();
    }
    touchStartX.current = null;
  };

  if (!isOpen || !media.length) {
    return null;
  }

  const hasMultipleItems = media.length > 1;
  const eventLabel = currentItem?.event ?? "Memory";
  const captionLabel = currentItem?.caption;
  const dateLabel = currentItem
    ? toLocalDate(currentItem.date).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "";
  const progressPercent = totalItems
    ? Math.min(100, ((activeIndex + 1) / totalItems) * 100)
    : 0;
  const accentPalette = ["#F7DEE2", "#D8ECFF", "#FFE89D", "#E8D4F8", "#B9E4FF"];
  const accentColor = accentPalette[activeIndex % accentPalette.length];
  const metadataKey = currentItem?.id ?? `meta-${activeIndex}`;

  return (
    <div
      className={`modal-backdrop-reveal modal-safe-area-mask fixed z-50 bg-black/80 px-3 py-6 text-white sm:px-8 sm:py-10 transition-opacity duration-300 ${
        isClosing ? "opacity-0" : "opacity-100"
      }`}
      style={{
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        paddingTop: "max(1.5rem, env(safe-area-inset-top))",
        paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      role="dialog"
      aria-modal="true"
      onClick={handleBackdropClick}
    >
      <div
        className={`modal-card-reveal relative flex w-full max-w-5xl flex-col gap-5 overflow-hidden rounded-[40px] bg-linear-to-br from-[#0a0a0a]/85 via-[#111]/80 to-[#1b1b1b]/70 p-4 text-white shadow-[0_25px_80px_rgba(0,0,0,0.65)] ring-1 ring-white/10 backdrop-blur-xl sm:p-8 transition-all duration-300 ${
          isClosing ? "opacity-0 scale-95" : "opacity-100 scale-100"
        }`}
        style={{
          paddingTop: "calc(env(safe-area-inset-top, 0px) + 1.5rem)",
        }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div className="pointer-events-none absolute inset-0">
          <div className="modal-glow absolute -top-16 left-8 h-56 w-56 rounded-full bg-[#F7DEE2]/35 blur-[120px]" />
          <div className="modal-glow absolute -bottom-10 right-0 h-64 w-64 rounded-full bg-[#D8ECFF]/30 blur-[140px]" />
        </div>
        <button
          type="button"
          className="cursor-pointer absolute right-4 top-3 z-20 flex h-11 w-11 items-center justify-center rounded-full bg-[#1a1a1a]/80 text-white/90 shadow-[0_4px_16px_rgba(0,0,0,0.4)] ring-1 ring-white/10 backdrop-blur-lg transition-all duration-200 hover:bg-[#2a2a2a] hover:text-white hover:ring-white/20 active:scale-95 sm:h-12 sm:w-12"
          style={{ top: "calc(env(safe-area-inset-top, 0px) + 0.75rem)" }}
          onClick={handleClose}
          aria-label="Close modal"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            className="transition-transform duration-200"
          >
            <line x1="2" y1="2" x2="14" y2="14" />
            <line x1="14" y1="2" x2="2" y2="14" />
          </svg>
        </button>

        <div className="relative flex min-h-80 flex-1 items-center justify-center rounded-4xl bg-linear-to-b from-transparent via-black/10 to-transparent p-4 sm:min-h-105 overflow-hidden backdrop-blur-sm">
          <div className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-linear-to-r from-[#050505] via-[#050505]/60 to-transparent opacity-60" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-linear-to-l from-[#050505] via-[#050505]/60 to-transparent opacity-60" />

          {currentItem ? (
            <div
              className={`flex w-full items-center gap-6 ${
                isAnimating ? "cursor-grabbing" : ""
              }`}
              style={{
                transform: `translateX(calc(${activeIndex} * (-100% - 1.5rem)))`,
                transitionDuration: hasInitialized
                  ? `${SLIDE_DURATION}ms`
                  : "0ms",
                transitionTimingFunction: "cubic-bezier(0.22,0.61,0.36,1)",
                transitionProperty: "transform",
              }}
            >
              {media.map((item, index) => {
                const isActiveSlide = index === activeIndex;
                const isItemVideo = isVideoMeta(item);

                return (
                  <div
                    key={`${item.id}-${index}`}
                    className={`relative flex h-full w-full shrink-0 basis-full items-center justify-center rounded-4xl bg-linear-to-br from-black/5 via-black/10 to-black/15 p-3 shadow-2xl transition-transform duration-500 backdrop-blur-[1px] ${
                      isActiveSlide
                        ? "scale-[1.02] opacity-100 drop-shadow-[0_35px_45px_rgba(0,0,0,0.35)]"
                        : "scale-95 opacity-100"
                    }`}
                  >
                    {isItemVideo ? (
                      <ModalVideo
                        isActive={isActiveSlide}
                        objectUrl={isActiveSlide ? activeVideoUrl : null}
                        posterUrl={
                          resolveVideoThumbUrl?.(item) ?? item.thumbUrl
                        }
                        videoRef={videoElRef}
                      />
                    ) : (
                      (() => {
                        const image = item as ImageMeta;
                        const thumbUrl =
                          resolveThumbUrl?.(image) ?? image.thumbUrl;
                        const fullUrl = fullResUrls.get(image.id);
                        const imgUrl = fullUrl ?? thumbUrl;
                        const isFullRes = fullResUrls.has(image.id);

                        return imgUrl ? (
                          <ModalImage
                            src={imgUrl}
                            thumbSrc={thumbUrl}
                            alt={
                              image.caption ?? image.event ?? "Gallery image"
                            }
                            isActive={isActiveSlide}
                            isFullRes={isFullRes}
                          />
                        ) : (
                          <p className="text-center text-sm text-white/80">
                            Unable to load image.
                          </p>
                        );
                      })()
                    )}
                    <div className="pointer-events-none absolute inset-y-0 -right-4 hidden w-10 bg-linear-to-l from-black/60 to-transparent sm:block" />
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-center text-sm text-white/80">
              Unable to load media.
            </p>
          )}

          {hasMultipleItems && (
            <div className="pointer-events-none absolute inset-0 hidden items-center justify-between px-2 sm:flex">
              <button
                type="button"
                onClick={goToPrev}
                className="cursor-pointer pointer-events-auto flex h-12 w-12 items-center justify-center rounded-full bg-white/15 text-xl shadow-lg shadow-black/40 backdrop-blur transition-all duration-200 hover:bg-white/30 hover:scale-110 active:scale-95"
                aria-label="Previous"
              >
                ←
              </button>
              <button
                type="button"
                onClick={goToNext}
                className="cursor-pointer pointer-events-auto flex h-12 w-12 items-center justify-center rounded-full bg-white/15 text-xl shadow-lg shadow-black/40 backdrop-blur transition-all duration-200 hover:bg-white/30 hover:scale-110 active:scale-95"
                aria-label="Next"
              >
                →
              </button>
            </div>
          )}
        </div>

        <footer
          className="flex flex-col gap-4 rounded-[28px] border border-white/10 bg-white/5 px-5 py-4 text-sm text-white/80 sm:flex-row sm:items-center sm:justify-between transition-all duration-300"
          aria-live="polite"
        >
          <div
            key={metadataKey}
            className="metadata-fade-up transition-opacity duration-200"
          >
            <p className="text-base font-semibold text-white">{eventLabel}</p>
            {captionLabel && (
              <p className="leading-relaxed text-white/80">{captionLabel}</p>
            )}
            {dateLabel && <p className="text-xs text-white/60">{dateLabel}</p>}
          </div>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:items-end">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-white/90">
                {activeIndex + 1}
              </span>
              <span className="text-xs text-white/40">/</span>
              <span className="text-xs text-white/60">{media.length}</span>
            </div>
            {media.length <= 10 ? (
              <div className="flex items-center gap-1.5" role="presentation">
                {Array.from({ length: media.length }, (_, i) => (
                  <button
                    key={i}
                    onClick={() =>
                      goToIndex(i, i > activeIndex ? "left" : "right")
                    }
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      i === activeIndex
                        ? "w-8 opacity-100"
                        : "w-1.5 opacity-40 hover:opacity-70"
                    }`}
                    style={{
                      backgroundColor:
                        i === activeIndex
                          ? accentColor
                          : "rgba(255, 255, 255, 0.6)",
                    }}
                    aria-label={`Go to image ${i + 1}`}
                  />
                ))}
              </div>
            ) : (
              <div
                className="relative h-1 w-full overflow-hidden rounded-full bg-white/10 sm:w-32"
                role="presentation"
              >
                <div
                  className="absolute inset-y-0 left-0 rounded-full transition-all duration-300"
                  style={{
                    width: `${progressPercent}%`,
                    backgroundColor: accentColor,
                    boxShadow: `0 0 12px ${accentColor}80`,
                  }}
                />
              </div>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
};

/** Image with loading spinner for the modal — layers thumb + full-res */
const ModalImage: React.FC<{
  src: string;
  alt: string;
  isActive: boolean;
  isFullRes: boolean;
  thumbSrc?: string;
}> = ({ src, alt, isActive, isFullRes, thumbSrc }) => {
  const [thumbLoaded, setThumbLoaded] = React.useState(false);
  const [fullLoaded, setFullLoaded] = React.useState(false);

  // Track the thumb src so we know when it changes (new image entirely)
  const prevThumbSrcRef = React.useRef(thumbSrc);
  if (prevThumbSrcRef.current !== thumbSrc) {
    prevThumbSrcRef.current = thumbSrc;
    setThumbLoaded(false);
    setFullLoaded(false);
  }

  // Reset full-res loaded when the full-res src changes
  const prevFullSrcRef = React.useRef(isFullRes ? src : null);
  const currentFullSrc = isFullRes ? src : null;
  if (prevFullSrcRef.current !== currentFullSrc) {
    prevFullSrcRef.current = currentFullSrc;
    setFullLoaded(false);
  }

  // Instantly mark loaded if the browser already decoded the image
  const thumbImgRef = React.useCallback(
    (img: HTMLImageElement | null) => {
      if (img && img.complete && img.naturalWidth > 0) {
        setThumbLoaded(true);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [thumbSrc],
  );

  const fullImgRef = React.useCallback(
    (img: HTMLImageElement | null) => {
      if (img && img.complete && img.naturalWidth > 0) {
        setFullLoaded(true);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentFullSrc],
  );

  const showSpinner =
    !thumbLoaded ||
    (isActive && !isFullRes) ||
    (isActive && isFullRes && !fullLoaded);
  const actualThumbSrc = thumbSrc ?? (isFullRes ? undefined : src);

  return (
    <div className="relative flex w-full items-center justify-center">
      {showSpinner && (
        <div className="absolute inset-0 z-10 flex items-center justify-center">
          <svg
            className="h-8 w-8 animate-spin text-white/40"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        </div>
      )}
      {/* Thumbnail layer — always visible as base */}
      {actualThumbSrc && (
        <img
          ref={thumbImgRef}
          src={actualThumbSrc}
          alt={alt}
          className={`max-h-[60vh] w-full rounded-[28px] object-contain ${
            isActive ? "kenburns-active" : ""
          } ${thumbLoaded ? "opacity-100" : "opacity-0"}`}
          loading={isActive ? "eager" : "lazy"}
          decoding="async"
          onLoad={() => setThumbLoaded(true)}
        />
      )}
      {/* Full-res layer — overlays once loaded */}
      {isFullRes && currentFullSrc && (
        <img
          ref={fullImgRef}
          src={currentFullSrc}
          alt={alt}
          className={`absolute inset-0 max-h-[60vh] w-full rounded-[28px] object-contain ${
            isActive ? "kenburns-active" : ""
          } ${fullLoaded ? "opacity-100" : "opacity-0"} transition-opacity duration-200`}
          loading={isActive ? "eager" : "lazy"}
          decoding="async"
          onLoad={() => setFullLoaded(true)}
        />
      )}
    </div>
  );
};

const ModalVideo: React.FC<{
  isActive: boolean;
  objectUrl: string | null;
  posterUrl: string;
  videoRef: React.MutableRefObject<HTMLVideoElement | null>;
}> = ({ isActive, objectUrl, posterUrl, videoRef }) => {
  // If the slide is not active, render only a poster image (no <video> tag)
  if (!isActive) {
    return (
      <img
        src={posterUrl}
        alt="Video thumbnail"
        className="max-h-[60vh] w-full rounded-[28px] object-contain relative z-20"
        decoding="async"
        loading="lazy"
      />
    );
  }

  if (!objectUrl) {
    // Still resolving download URL / fetching bytes
    return (
      <div className="relative flex w-full items-center justify-center">
        <img
          src={posterUrl}
          alt="Video thumbnail"
          className="max-h-[60vh] w-full rounded-[28px] object-contain opacity-70 relative z-20"
          decoding="async"
          loading="eager"
        />
        <div className="absolute inset-0 z-10 flex items-center justify-center">
          <svg
            className="h-8 w-8 animate-spin text-white/40"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        </div>
      </div>
    );
  }

  return (
    <video
      ref={(el) => {
        videoRef.current = el;
      }}
      src={objectUrl}
      poster={posterUrl}
      autoPlay
      controls
      playsInline
      className="max-h-[60vh] w-full rounded-[28px] object-contain relative z-30"
    />
  );
};

export default ImageModalViewer;
