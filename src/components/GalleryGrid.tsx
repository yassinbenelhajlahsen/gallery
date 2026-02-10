// src/components/GalleryGrid.tsx
import React from "react";

export type GalleryGridTile = {
  id: string;
  url: string;
  /** Optional full-res URL — overlaid on top of the thumb when loaded */
  fullUrl?: string;
  /** Optional media discriminator for UI only */
  mediaType?: "image" | "video";
  caption?: string;
  onClick?: () => void;
};

export type GalleryGridProps = {
  tiles: GalleryGridTile[];
  columns?: {
    base?: number;
    sm?: number;
    md?: number;
    lg?: number;
  };
};

const GalleryGrid: React.FC<GalleryGridProps> = ({ tiles, columns }) => {
  const baseCols = columns?.base ?? 2;
  const smCols = columns?.sm ?? 3;
  const mdCols = columns?.md ?? 4;
  const lgCols = columns?.lg ?? mdCols;

  const mapCols = (prefix: string, value: number) => {
    switch (value) {
      case 1:
        return `${prefix}grid-cols-1`;
      case 2:
        return `${prefix}grid-cols-2`;
      case 3:
        return `${prefix}grid-cols-3`;
      case 4:
        return `${prefix}grid-cols-4`;
      case 5:
        return `${prefix}grid-cols-5`;
      case 6:
        return `${prefix}grid-cols-6`;
      default:
        return `${prefix}grid-cols-2`;
    }
  };

  const columnClass = [
    "grid",
    "gap-3 sm:gap-4",
    mapCols("", baseCols),
    mapCols("sm:", smCols),
    mapCols("md:", mdCols),
    mapCols("lg:", lgCols),
  ].join(" ");

  if (!tiles.length) {
    return (
      <div className="rounded-3xl border border-dashed border-[#EDEDED] bg-white/70 px-6 py-10 text-center text-[#777]">
        <p>No media yet. They'll appear as soon as we sync your gallery.</p>
      </div>
    );
  }

  return (
    <div className={columnClass}>
      {tiles.map((tile) => (
        <TileItem key={tile.id} tile={tile} />
      ))}
    </div>
  );
};

const TileItem: React.FC<{ tile: GalleryGridTile }> = ({ tile }) => {
  const [thumbLoaded, setThumbLoaded] = React.useState(false);
  const [fullLoaded, setFullLoaded] = React.useState(false);
  const [hasError, setHasError] = React.useState(false);

  const hasFullRes = Boolean(tile.fullUrl && tile.fullUrl !== tile.url);
  const isVideo = tile.mediaType === "video";

  // Check if the image is already decoded (browser cache / blob URL hot)
  const thumbRef = React.useCallback(
    (img: HTMLImageElement | null) => {
      if (img && img.complete && img.naturalWidth > 0) setThumbLoaded(true);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tile.url],
  );

  const fullRef = React.useCallback(
    (img: HTMLImageElement | null) => {
      if (img && img.complete && img.naturalWidth > 0) setFullLoaded(true);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tile.fullUrl],
  );

  return (
    <button
      type="button"
      onClick={tile.onClick}
      className="group relative aspect-square overflow-hidden rounded-2xl bg-white/80 shadow-sm ring-1 ring-white/60 transition-all duration-200 hover:scale-[1.02] hover:shadow-xl active:scale-[0.98] touch-manipulation"
      style={{ willChange: "transform" }}
    >
      {/* Inner clipping wrapper for mobile Safari stability: keep rounding and overflow consistent */}
      <div className="absolute inset-0 rounded-2xl overflow-hidden">
        {!thumbLoaded && !hasError && (
          <div className="skeleton-loader absolute inset-0 rounded-2xl" />
        )}

        <img
          ref={thumbRef}
          src={tile.url}
          alt={tile.caption ?? "Gallery image"}
          className={`cursor-pointer h-full w-full object-cover rounded-2xl ${
            thumbLoaded ? "opacity-100" : "opacity-0"
          }`}
          decoding="async"
          loading="lazy"
          onLoad={() => setThumbLoaded(true)}
          onError={() => setHasError(true)}
        />

        {hasFullRes && tile.fullUrl && (
          <img
            ref={fullRef}
            src={tile.fullUrl}
            alt={tile.caption ?? "Gallery image"}
            className={`cursor-pointer absolute inset-0 h-full w-full object-cover rounded-2xl ${
              fullLoaded ? "opacity-100" : "opacity-0"
            } transition-opacity duration-200`}
            decoding="async"
            loading="lazy"
            onLoad={() => setFullLoaded(true)}
          />
        )}

        {isVideo && !hasError && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="cursor-pointer flex h-12 w-12 items-center justify-center rounded-full bg-black/45 text-white/90 ring-1 ring-white/20 backdrop-blur-sm">
              ▶
            </span>
          </div>
        )}

        {hasError && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#f5f5f5] text-sm text-[#999] rounded-2xl">
            ✕
          </div>
        )}
      </div>
    </button>
  );
};

export default GalleryGrid;
