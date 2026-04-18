import React from "react";
import type { ImageMeta } from "../../services/storageService";
import type { MediaMeta, VideoMeta } from "../../types/mediaTypes";
import { isVideoMeta } from "../../types/mediaTypes";
import { isLowBandwidthMobileClient } from "../../utils/runtime";
import { useVideoPrefetch, VIDEO_BOOSTER_POOL_SIZE } from "../../hooks/useVideoPrefetch";
import { useCarouselNavigation } from "../../hooks/useCarouselNavigation";
import { useModalViewportLock } from "../../hooks/useModalViewportLock";
import { useModalVideoManager } from "../../hooks/useModalVideoManager";
import { useFullResPreloader } from "../../hooks/useFullResPreloader";
import { useMediaSwipeGesture } from "../../hooks/useMediaSwipeGesture";

export type MediaModalViewer = {
  media: MediaMeta[];
  initialIndex?: number;
  isOpen: boolean;
  onClose: () => void;
  onChangeIndex?: (nextIndex: number) => void;
  /** Resolves a cached thumbnail blob URL for an image (used as placeholder) */
  resolveThumbUrl?: (image: ImageMeta) => string;
  /** Resolves a cached thumbnail blob URL for a video (used for poster) */
  resolveVideoThumbUrl?: (video: VideoMeta) => string;
  /** Resolves a cached full-res blob URL if available, otherwise null */
  resolveFullResUrl?: (image: ImageMeta) => string | null;
  /** When true, preload full-res for ALL images instead of only the ±N window */
  preloadAll?: boolean;
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

function clampIndex(index: number, length: number) {
  if (length === 0) return 0;
  if (index < 0) return length - 1;
  if (index >= length) return 0;
  return index;
}

const MediaModalViewer: React.FC<MediaModalViewer> = ({
  media,
  initialIndex = 0,
  isOpen,
  onClose,
  onChangeIndex,
  resolveThumbUrl,
  resolveVideoThumbUrl,
  resolveFullResUrl,
  preloadAll = false,
}) => {
  const slideContainerRef = React.useRef<HTMLDivElement | null>(null);
  const modalRootRef = React.useRef<HTMLDivElement | null>(null);
  const videoElRef = React.useRef<HTMLVideoElement | null>(null);

  const isMobile = isLowBandwidthMobileClient();
  const PRELOAD_AHEAD = isMobile ? 3 : 10;
  const PRELOAD_BEHIND = isMobile ? 2 : 5;

  const nav = useCarouselNavigation({
    mediaLength: media.length,
    initialIndex,
    isOpen,
    onChangeIndex,
    onClose,
  });

  useModalViewportLock(isOpen);
  const currentItem = media[nav.dataIndex];
  const { activeVideoUrl } = useModalVideoManager(isOpen, currentItem, videoElRef);
  const { fullResUrls } = useFullResPreloader({
    isOpen,
    media,
    dataIndex: nav.dataIndex,
    preloadAll,
    preloadAhead: PRELOAD_AHEAD,
    preloadBehind: PRELOAD_BEHIND,
    resolveFullResUrl,
  });
  const swipe = useMediaSwipeGesture({
    mediaLength: media.length,
    visualIndex: nav.visualIndex,
    slideDuration: nav.slideDuration,
    goToNext: nav.goToNext,
    goToPrev: nav.goToPrev,
    slideContainerRef,
  });

  const { prefetchedUrls } = useVideoPrefetch({
    media,
    dataIndex: nav.dataIndex,
    isOpen,
    preloadAll,
    isMobile,
  });

  const boosterEntries = React.useMemo(
    () => [...prefetchedUrls.entries()].slice(0, VIDEO_BOOSTER_POOL_SIZE),
    [prefetchedUrls],
  );

  // Entry animation flag — false until two RAF ticks after open
  const [hasInitialized, setHasInitialized] = React.useState(false);

  React.useLayoutEffect(() => {
    if (isOpen) setHasInitialized(false);
  }, [isOpen]);

  React.useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => { setHasInitialized(true); });
      });
    }
  }, [isOpen]);

  // Keyboard navigation + escape
  React.useEffect(() => {
    if (!isOpen) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        nav.handleClose();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        nav.goToNext();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        nav.goToPrev();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, nav]);

  // Focus trap: keep Tab cycling within modal
  React.useEffect(() => {
    if (!isOpen) return;
    const FOCUSABLE =
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    const trap = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const root = modalRootRef.current;
      if (!root) return;
      const nodes = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => !el.hasAttribute("disabled"),
      );
      if (!nodes.length) return;
      const first = nodes[0]!;
      const last = nodes[nodes.length - 1]!;
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", trap);
    return () => document.removeEventListener("keydown", trap);
  }, [isOpen]);

  if (!isOpen || !media.length) return null;

  const hasMultipleItems = media.length > 1;
  const eventLabel = currentItem?.event ?? "";
  const dateLabel = currentItem
    ? toLocalDate(currentItem.date).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "";
  const totalItems = media.length;
  const progressPercent = totalItems
    ? Math.min(100, ((nav.dataIndex + 1) / totalItems) * 100)
    : 0;
  const accentPalette = ["#F7DEE2", "#D8ECFF", "#FFE89D", "#E8D4F8", "#B9E4FF"];
  const accentColor = accentPalette[nav.dataIndex % accentPalette.length];
  const metadataKey = currentItem?.id ?? `meta-${nav.dataIndex}`;

  return (
    <div
      ref={modalRootRef}
      className={`modal-backdrop-reveal fixed z-50 bg-black/80 px-3 py-6 text-white sm:px-8 sm:py-10 transition-opacity duration-300 ${
        nav.isClosing ? "opacity-0" : "opacity-100"
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
      onClick={(event) => { if (event.target === event.currentTarget) nav.handleClose(); }}
    >
      <div
        className={`relative flex w-full max-w-5xl flex-col gap-5 overflow-hidden rounded-[40px] bg-linear-to-br from-[#0a0a0a]/85 via-[#111]/80 to-[#1b1b1b]/70 p-4 text-white shadow-[0_25px_80px_rgba(0,0,0,0.65)] ring-1 ring-white/10 backdrop-blur-xl sm:p-8 transition-[opacity,transform] duration-300 ${
          hasInitialized && !nav.isClosing ? "opacity-100 scale-100" : "opacity-0 scale-95"
        }`}
        onTouchStart={swipe.onTouchStart}
        onTouchMove={swipe.onTouchMove}
        onTouchEnd={swipe.onTouchEnd}
      >
        <div className="pointer-events-none absolute inset-0">
          <div className="modal-glow absolute -top-16 left-8 h-56 w-56 rounded-full bg-[#F7DEE2]/35 blur-[120px]" />
          <div className="modal-glow absolute -bottom-10 right-0 h-64 w-64 rounded-full bg-[#D8ECFF]/30 blur-[140px]" />
        </div>
        <button
          type="button"
          className="cursor-pointer absolute right-4 top-3 z-20 flex h-11 w-11 items-center justify-center rounded-full bg-[#1a1a1a]/80 text-white/90 shadow-[0_4px_16px_rgba(0,0,0,0.4)] ring-1 ring-white/10 backdrop-blur-lg transition-all duration-200 hover:bg-[#2a2a2a] hover:text-white hover:ring-white/20 active:scale-95 sm:h-12 sm:w-12"
          onClick={nav.handleClose}
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

          <div
            ref={slideContainerRef}
            className={`flex w-full items-center gap-6 ${nav.isAnimating ? "cursor-grabbing" : ""}`}
            style={{
              transform: `translateX(calc(${nav.visualIndex} * (-100% - 1.5rem)))`,
              transitionDuration:
                hasInitialized && !nav.suppressTransition
                  ? `${nav.slideDuration}ms`
                  : "0ms",
              transitionTimingFunction: "cubic-bezier(0.22,0.61,0.36,1)",
              transitionProperty: "transform",
            }}
          >
            {media.map((item, index) => {
              const isActiveSlide = index === nav.dataIndex;
              const isNearby = Math.abs(index - nav.dataIndex) <= 3;
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
                  {isNearby && (
                    <>
                      {isItemVideo ? (
                        <ModalVideo
                          isActive={isActiveSlide}
                          objectUrl={isActiveSlide ? activeVideoUrl : null}
                          posterUrl={resolveVideoThumbUrl?.(item) ?? item.thumbUrl}
                          videoRef={videoElRef}
                        />
                      ) : (
                        (() => {
                          const image = item as ImageMeta;
                          const thumbUrl = resolveThumbUrl?.(image) ?? image.thumbUrl;
                          const fullUrl = fullResUrls.get(image.id);
                          const imgUrl = fullUrl ?? thumbUrl;
                          const isFullRes = fullResUrls.has(image.id);

                          return imgUrl ? (
                            <ModalImage
                              src={imgUrl}
                              thumbSrc={thumbUrl}
                              alt={image.event ?? "Gallery image"}
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
                    </>
                  )}
                </div>
              );
            })}
          </div>

          {hasMultipleItems && (
            <div className="pointer-events-none absolute inset-0 hidden items-center justify-between px-2 sm:flex">
              <button
                type="button"
                onClick={nav.goToPrev}
                className="cursor-pointer pointer-events-auto flex h-12 w-12 items-center justify-center rounded-full bg-white/15 text-xl shadow-lg shadow-black/40 backdrop-blur transition-all duration-200 hover:bg-white/30 hover:scale-110 active:scale-95"
                aria-label="Previous"
              >
                ←
              </button>
              <button
                type="button"
                onClick={nav.goToNext}
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
            {dateLabel && <p className="text-xs text-white/60">{dateLabel}</p>}
          </div>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:items-end">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-white/90">
                {clampIndex(nav.dataIndex, media.length) + 1}
              </span>
              <span className="text-xs text-white/40">/</span>
              <span className="text-xs text-white/60">{media.length}</span>
            </div>
            {media.length <= 10 ? (
              <div className="flex items-center gap-1.5" role="presentation">
                {Array.from({ length: media.length }, (_, i) => (
                  <button
                    key={i}
                    onClick={() => nav.goToIndex(i, i > nav.dataIndex ? "left" : "right")}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      i === nav.dataIndex ? "w-8 opacity-100" : "w-1.5 opacity-40 hover:opacity-70"
                    }`}
                    style={{
                      backgroundColor:
                        i === nav.dataIndex ? accentColor : "rgba(255, 255, 255, 0.6)",
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

      {/* Hidden video booster elements — decoder warmup for prefetched neighbours (desktop only) */}
      {!isMobile && hasInitialized && (
        <div
          aria-hidden
          style={{
            position: "absolute",
            width: 1,
            height: 1,
            overflow: "hidden",
            opacity: 0,
            pointerEvents: "none",
            left: -9999,
            top: -9999,
          }}
        >
          {boosterEntries.map(([id, url]) => (
            <video key={id} src={url} preload="metadata" muted playsInline />
          ))}
        </div>
      )}
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
  const currentFullSrc = isFullRes ? src : null;
  // Only skip the thumbnail when the full-res URL is a local blob (cached in
  // IndexedDB). If it's a Firebase download URL the image is still fetching
  // over the network, so the thumb should remain as a progressive placeholder.
  // The ref captures the state at mount so a later URL change doesn't
  // retroactively hide the thumbnail mid-display.
  const isLocalFullRes = Boolean(currentFullSrc?.startsWith("blob:"));
  const localFullResOnMountRef = React.useRef(isLocalFullRes);
  const skipThumb = localFullResOnMountRef.current && isLocalFullRes;

  const [thumbLoaded, setThumbLoaded] = React.useState(false);
  const [fullLoaded, setFullLoaded] = React.useState(false);

  React.useEffect(() => {
    setThumbLoaded(false);
    setFullLoaded(false);
  }, [thumbSrc]);

  React.useEffect(() => {
    setFullLoaded(false);
  }, [currentFullSrc]);

  const thumbImgRef = React.useCallback(
    (img: HTMLImageElement | null) => {
      if (img && img.complete && img.naturalWidth > 0) setThumbLoaded(true);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [thumbSrc],
  );

  const fullImgRef = React.useCallback(
    (img: HTMLImageElement | null) => {
      if (img && img.complete && img.naturalWidth > 0) setFullLoaded(true);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentFullSrc],
  );

  const showSpinner = skipThumb ? !fullLoaded : !thumbLoaded;
  const actualThumbSrc = skipThumb ? undefined : (thumbSrc ?? (isFullRes ? undefined : src));
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
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        </div>
      )}
      {actualThumbSrc && (
        <img
          ref={thumbImgRef}
          src={actualThumbSrc}
          alt={alt}
          className={`max-h-[60vh] w-full rounded-[28px] object-contain ${isActive ? "kenburns-active" : ""} ${thumbLoaded ? "opacity-100" : "opacity-0"}`}
          loading={isActive ? "eager" : "lazy"}
          decoding="async"
          onLoad={() => setThumbLoaded(true)}
        />
      )}
      {isFullRes && currentFullSrc && (
        <img
          ref={fullImgRef}
          src={currentFullSrc}
          alt={alt}
          className={`${skipThumb ? "" : "absolute inset-0"} max-h-[60vh] w-full rounded-[28px] object-contain ${isActive ? "kenburns-active" : ""} ${fullLoaded ? "opacity-100" : "opacity-0"} transition-opacity duration-200`}
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
  videoRef: React.RefObject<HTMLVideoElement | null>;
}> = ({ isActive, objectUrl, posterUrl, videoRef }) => {
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
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
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
      ref={(el) => { videoRef.current = el; }}
      src={objectUrl}
      poster={posterUrl}
      autoPlay
      controls
      playsInline
      className="max-h-[60vh] w-full rounded-[28px] object-contain relative z-30"
    />
  );
};

export default MediaModalViewer;
