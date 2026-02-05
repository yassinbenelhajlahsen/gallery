import React from "react";
import { useNavigate } from "react-router-dom";
import { useGallery } from "../context/GalleryContext";
import type { ImageMeta } from "../services/storageService";
import { usePageReveal } from "../hooks/usePageReveal";
import { useFullResLoader } from "../hooks/useFullResLoader";
import { config } from "../config";

type CloudTile = {
  meta: ImageMeta;
  url: string;
  thumbUrl: string;
  caption?: string;
};

const pickRandomSubset = <T,>(items: T[], count: number): T[] => {
  if (count >= items.length) return [...items];
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, count);
};

const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { imageMetas, resolveThumbUrl, openModalWithImages } = useGallery();
  const isVisible = usePageReveal();
  const { resolveUrl, requestFullRes } = useFullResLoader();

  // Store the *IDs* of chosen tiles so re-renders/re-mounts use the same set
  const [chosenIds, setChosenIds] = React.useState<string[]>([]);

  // Only re-pick when the actual set of available image IDs changes
  const metaIdFingerprint = React.useMemo(
    () => imageMetas.map((m) => m.id).join(","),
    [imageMetas],
  );

  React.useEffect(() => {
    if (!imageMetas.length) {
      setChosenIds([]);
      return;
    }

    setChosenIds((prev) => {
      // If every previously-chosen ID still exists, keep the selection stable
      const available = new Set(imageMetas.map((m) => m.id));
      const allStillExist =
        prev.length > 0 && prev.every((id) => available.has(id));
      if (allStillExist) return prev;

      // Otherwise pick a fresh random subset
      const isMobile = window.innerWidth < 640;
      const desired = Math.min(imageMetas.length, isMobile ? 6 : 9);
      return pickRandomSubset(imageMetas, desired).map((m) => m.id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metaIdFingerprint]);

  // Kick off full-res loading for the chosen tiles
  const chosenMetas = React.useMemo(
    () =>
      chosenIds
        .map((id) => imageMetas.find((m) => m.id === id))
        .filter(Boolean) as ImageMeta[],
    [chosenIds, imageMetas],
  );

  React.useEffect(() => {
    if (chosenMetas.length) requestFullRes(chosenMetas);
  }, [chosenMetas, requestFullRes]);

  // Build the display tiles from the stable IDs
  const cloudTiles = React.useMemo<CloudTile[]>(() => {
    if (!chosenIds.length || !imageMetas.length) return [];
    return chosenIds
      .map((id) => {
        const meta = imageMetas.find((m) => m.id === id);
        if (!meta) return null;
        const thumbUrl = resolveThumbUrl(meta);
        return {
          meta,
          url: resolveUrl(meta, thumbUrl),
          thumbUrl,
          caption: meta.caption ?? meta.event ?? "Captured memory",
        };
      })
      .filter(Boolean) as CloudTile[];
  }, [chosenIds, imageMetas, resolveThumbUrl, resolveUrl]);

  const handleTileClick = React.useCallback(
    (metaId: string) => {
      if (!cloudTiles.length) return;
      const subset = cloudTiles.map((tile) => tile.meta);
      const index = subset.findIndex((meta) => meta.id === metaId);
      openModalWithImages(subset, {
        initialIndex: index >= 0 ? index : 0,
      });
    },
    [cloudTiles, openModalWithImages],
  );

  const handleSeeAll = () => {
    navigate("/gallery", { state: { transition: "fade" } });
  };

  const renderEmptyState = () => (
    <div className="rounded-4xl border border-dashed border-[#FDE2EB] bg-white/80 px-6 py-10 text-center text-[#777] shadow-inner shadow-white/50">
      <p className="text-lg font-medium">
        We’re still fetching your latest memories. They’ll bloom here soon.
      </p>
    </div>
  );

  return (
    <section className="flex w-full justify-center">
      <div
        className={`mx-auto w-full max-w-5xl sm:max-w-full space-y-10 rounded-[36px] bg-white/80 p-10 text-center shadow-[0_35px_120px_rgba(248,180,196,0.35)] ring-1 ring-white/60 backdrop-blur-2xl transition-all duration-400 ease-out ${
          isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
        }`}
      >
        <div className="space-y-3">
          <p className="text-5xl uppercase tracking-[0.35em] mt-5 mb-15">
            {config.coupleDisplay}
          </p>
        </div>

        {cloudTiles.length ? (
          // Simplified responsive grid — keep mobile layout, make tiles larger on bigger screens
          <div className="mx-auto grid w-full max-w-4xl grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-3 md:grid-cols-3 md:max-w-5xl lg:grid-cols-3 lg:max-w-6xl xl:max-w-7xl">
            {cloudTiles.map((tile) => (
              <button
                type="button"
                key={tile.meta.id}
                onClick={() => handleTileClick(tile.meta.id)}
                className="group relative overflow-hidden rounded-2xl bg-linear-to-br from-[#FFF5DA] via-[#FDFDFB] to-[#FFE9F1] shadow-lg ring-1 ring-white/60 transition-all duration-200 hover:scale-[1.03] active:scale-[0.98] touch-manipulation"
                style={{ willChange: "transform" }}
                aria-label={tile.caption ?? "Open memory"}
              >
                <div className="w-full aspect-square">
                  <HomeTileImage
                    src={tile.url}
                    thumbSrc={tile.thumbUrl}
                    alt={tile.caption ?? "Romantic memory"}
                  />
                </div>
              </button>
            ))}
          </div>
        ) : (
          renderEmptyState()
        )}

        <div className="pt-4">
          <button
            type="button"
            onClick={handleSeeAll}
            className="inline-flex items-center gap-3 rounded-full bg-linear-to-r from-[#FFE39F] via-[#FFB1C7] to-[#D8ECFF] px-8 py-3 text-lg font-semibold text-[#2c2c2c] shadow-lg shadow-[#ffe1b8]/60 transition-all duration-200 hover:scale-105 active:scale-95 touch-manipulation mt-5"
          >
            See all memories
            <span aria-hidden="true">→</span>
          </button>
        </div>
      </div>
    </section>
  );
};

/** Tile image — shows thumb immediately, overlays full-res when loaded */
const HomeTileImage: React.FC<{
  src: string;
  thumbSrc: string;
  alt: string;
}> = ({ src, thumbSrc, alt }) => {
  const [thumbLoaded, setThumbLoaded] = React.useState(false);
  const [fullLoaded, setFullLoaded] = React.useState(false);
  const [error, setError] = React.useState(false);

  const isFullRes = src !== thumbSrc;

  const thumbRef = React.useCallback(
    (img: HTMLImageElement | null) => {
      if (img && img.complete && img.naturalWidth > 0) setThumbLoaded(true);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [thumbSrc],
  );

  const fullRef = React.useCallback(
    (img: HTMLImageElement | null) => {
      if (img && img.complete && img.naturalWidth > 0) setFullLoaded(true);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [src],
  );

  return (
    <>
      {!thumbLoaded && !error && (
        <div className="skeleton-loader absolute inset-0" />
      )}
      {/* Thumbnail layer — always visible as base */}
      <img
        ref={thumbRef}
        src={thumbSrc}
        alt={alt}
        className={`h-full w-full object-cover group-hover:opacity-95 ${
          thumbLoaded ? "opacity-100" : "opacity-0"
        }`}
        decoding="sync"
        onLoad={() => setThumbLoaded(true)}
        onError={() => setError(true)}
      />
      {/* Full-res layer — overlaid once loaded */}
      {isFullRes && (
        <img
          ref={fullRef}
          src={src}
          alt={alt}
          className={`absolute inset-0 h-full w-full object-cover group-hover:opacity-95 ${
            fullLoaded ? "opacity-100" : "opacity-0"
          } transition-opacity duration-200`}
          decoding="async"
          onLoad={() => setFullLoaded(true)}
        />
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#f5f5f5] text-sm text-[#999]">
          ✕
        </div>
      )}
    </>
  );
};

export default HomePage;
